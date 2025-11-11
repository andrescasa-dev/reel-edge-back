import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StateAbbreviation,
  getAllStates,
} from '../../../shared/domain/enums/state.enum';
import { ResearchStatus } from '../../../shared/domain/enums/research-status.enum';
import { ReelEdgeData } from '../../../shared/infrastructure/external-apis/reel-edge/reel-edge.client';
import { ReelEdgeDBClient } from '../../../shared/infrastructure/external-apis/reel-edge/reel-edge.client';
import { CasinoDiscoveryService } from '../../../casino-discovery/application/services/casino-discovery.service';
import { PromotionResearchService } from '../../../promotion-research/application/services/promotion-research.service';
import { ResearchJobRepository } from '../../infrastructure/repositories/research-job.repository';
import {
  ResearchJob,
  ResearchJobStatus,
} from '../../domain/entities/research-job.entity';
import { CasinoRepository } from '../../../shared/infrastructure/repositories/casino.repository';
import { Casino } from '../../../shared/domain/entities/casino.entity';
import { Promotion } from '../../../promotion-research/domain/entities/promotion.entity';
import { ScheduledJobRepository } from '../../infrastructure/repositories/scheduled-job.repository';
import { ScheduledJob } from '../../domain/interfaces/scheduled-job.repository.interface';
import parser from 'cron-parser';

/**
 * Research Orchestration Service
 * Coordinates full research workflow: casino discovery and promotion research
 * Manages global research status and error recovery
 */
@Injectable()
export class ResearchOrchestrationService {
  private readonly logger = new Logger(ResearchOrchestrationService.name);
  private globalResearchStatus: ResearchStatus = ResearchStatus.IDLE;
  private currentResearchJobId: string | null = null;
  private shouldStopResearch = false;

  constructor(
    private readonly reelEdgeClient: ReelEdgeDBClient,
    private readonly casinoDiscoveryService: CasinoDiscoveryService,
    private readonly promotionResearchService: PromotionResearchService,
    private readonly researchJobRepository: ResearchJobRepository,
    private readonly scheduledJobRepository: ScheduledJobRepository,
    private readonly casinoRepository: CasinoRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get current global research status
   */
  getResearchStatus(): ResearchStatus {
    return this.globalResearchStatus;
  }

  /**
   * Start full research for all states
   * Fetches Reel Edge data ONCE and processes states sequentially
   */
  async startFullResearch(): Promise<ResearchJob> {
    if (this.globalResearchStatus === ResearchStatus.RESEARCHING) {
      this.logger.warn('Research already in progress');
      const runningJob = await this.researchJobRepository.findRunning();
      if (runningJob) {
        return runningJob;
      }
    }

    this.logger.log('Starting full research for all states');
    this.globalResearchStatus = ResearchStatus.RESEARCHING;
    this.shouldStopResearch = false;

    const states = getAllStates();
    const researchJob = await this.researchJobRepository.create({
      states,
      status: ResearchJobStatus.RUNNING,
    });

    this.currentResearchJobId = researchJob.id;

    try {
      this.logger.log(
        'Fetching Reel Edge DB data (single fetch for entire job)',
      );
      const cachedReelEdgeData = await this.reelEdgeClient.fetchAllActiveData();
      this.logger.log(
        `Fetched ${cachedReelEdgeData.casinos.length} casinos and ${this.countTotalPromotions(cachedReelEdgeData.promotions)} promotions`,
      );

      const stateResults: Record<string, any> = {};
      let totalMissingCasinos = 0;
      let totalComparisons = 0;

      for (const state of states) {
        if (this.shouldStopResearch) {
          this.logger.warn(
            `Research stopped by user. Completed ${Object.keys(stateResults).length} states`,
          );
          break;
        }

        try {
          this.logger.log(`Processing state: ${state}`);
          const stateResult = await this.researchState(
            state,
            cachedReelEdgeData,
          );
          stateResults[state] = stateResult;
          totalMissingCasinos += stateResult.missingCasinos;
          totalComparisons += stateResult.comparisons;
        } catch (error) {
          this.logger.error(`Error processing state ${state}`, error);
          const errorResult = await this.handleResearchError(
            researchJob.id,
            state,
            error as Error,
          );
          stateResults[state] = {
            error: errorResult.message,
            missingCasinos: 0,
            comparisons: 0,
          };
        }
      }

      const results = {
        statesProcessed: Object.keys(stateResults).length,
        totalStates: states.length,
        totalMissingCasinos,
        totalComparisons,
        stateResults,
      };

      await this.researchJobRepository.complete(researchJob.id, results);

      this.logger.log(
        `Research completed: ${totalMissingCasinos} missing casinos, ${totalComparisons} comparisons`,
      );

      return (await this.researchJobRepository.findById(
        researchJob.id,
      )) as ResearchJob;
    } catch (error) {
      this.logger.error('Fatal error during research', error);
      await this.researchJobRepository.fail(researchJob.id, {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    } finally {
      this.globalResearchStatus = ResearchStatus.IDLE;
      this.currentResearchJobId = null;
      this.shouldStopResearch = false;
    }
  }

  /**
   * Research a single state: discovery + promotion research
   */
  async researchState(
    state: StateAbbreviation,
    cachedReelEdgeData: ReelEdgeData,
  ): Promise<{
    missingCasinos: number;
    comparisons: number;
  }> {
    this.logger.log(`Starting research for state: ${state}`);

    const discoveryResult =
      await this.casinoDiscoveryService.discoverCasinosForState(
        state,
        cachedReelEdgeData,
      );

    this.logger.log(
      `Discovery complete for ${state}: ${discoveryResult.missing} missing casinos`,
    );

    const stateCasinos = cachedReelEdgeData.casinos.filter(
      (casino) => casino.state === state,
    );

    const batchSize =
      this.configService.get<number>('research.promotionBatchSize') || 7;
    let totalComparisons = 0;

    if (stateCasinos.length > 0) {
      this.logger.log(
        `Starting promotion research for ${stateCasinos.length} casinos in batches of ${batchSize}`,
      );

      for (let i = 0; i < stateCasinos.length; i += batchSize) {
        if (this.shouldStopResearch) {
          this.logger.warn(
            `Research stopped. Processed ${i} casinos for ${state}`,
          );
          break;
        }

        const casinoBatch = stateCasinos.slice(i, i + batchSize);
        const existingPromotions = this.getExistingPromotionsForCasinos(
          casinoBatch,
          cachedReelEdgeData.promotions,
        );

        const batchResult =
          await this.promotionResearchService.researchPromotionsForCasinoBatch(
            casinoBatch,
            existingPromotions,
          );

        totalComparisons += batchResult.created;
        this.logger.log(
          `Batch ${Math.floor(i / batchSize) + 1}: Created ${batchResult.created} comparisons, filtered ${batchResult.filtered}`,
        );

        if (i + batchSize < stateCasinos.length) {
          const delayMs = 3000;
          this.logger.debug(`Waiting ${delayMs}ms before next batch`);
          await this.delay(delayMs);
        }
      }
    }

    if (discoveryResult.missingCasinos.length > 0) {
      this.logger.log(
        `Researching promotions for ${discoveryResult.missingCasinos.length} missing casinos`,
      );

      for (const missingCasino of discoveryResult.missingCasinos) {
        if (this.shouldStopResearch) {
          break;
        }

        const missingCasinoData = Casino.create({
          casinodb_id: 0,
          name: missingCasino.name,
          state: missingCasino.state,
          website: missingCasino.website,
          regulatoryId: missingCasino.regulatoryId,
        });

        const batchResult =
          await this.promotionResearchService.researchPromotionsForCasinoBatch(
            [missingCasinoData],
            new Map(),
          );

        totalComparisons += batchResult.created;
      }
    }

    return {
      missingCasinos: discoveryResult.missing,
      comparisons: totalComparisons,
    };
  }

  /**
   * Stop ongoing research
   */
  async stopResearch(): Promise<void> {
    if (this.globalResearchStatus === ResearchStatus.IDLE) {
      this.logger.warn('No research in progress to stop');
      return;
    }

    this.logger.log('Stopping research...');
    this.shouldStopResearch = true;

    if (this.currentResearchJobId) {
      try {
        const job = await this.researchJobRepository.findById(
          this.currentResearchJobId,
        );
        if (job && job.isRunning()) {
          await this.researchJobRepository.update(this.currentResearchJobId, {
            status: ResearchJobStatus.FAILED,
            errors: {
              message: 'Research stopped by user',
              stoppedAt: new Date().toISOString(),
            },
          });
        }
      } catch (error) {
        this.logger.error('Error updating research job on stop', error);
      }
    }
  }

  /**
   * Handle research errors with retry logic
   */
  private async handleResearchError(
    jobId: string,
    state: StateAbbreviation,
    error: Error,
  ): Promise<{ message: string; retried: boolean }> {
    this.logger.error(`Error in research for state ${state}`, error);

    const errorDetails = {
      state,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };

    try {
      const job = await this.researchJobRepository.findById(jobId);
      if (job) {
        const existingErrors = (job.errors as Record<string, unknown>) || {};
        const stateErrors = (existingErrors[state] as unknown[]) || [];
        stateErrors.push(errorDetails);

        await this.researchJobRepository.update(jobId, {
          errors: {
            ...existingErrors,
            [state]: stateErrors,
          },
        });
      }
    } catch (updateError) {
      this.logger.error('Failed to update job with error details', updateError);
    }

    return {
      message: error.message,
      retried: false,
    };
  }

  /**
   * Get existing promotions for a batch of casinos
   */
  private getExistingPromotionsForCasinos(
    casinos: Casino[],
    promotionsMap: Map<number, Promotion[]>,
  ): Map<number, Promotion[]> {
    const result = new Map<number, Promotion[]>();

    for (const casino of casinos) {
      const casinodbId = casino.casinodb_id;
      const promotions = promotionsMap.get(casinodbId) || [];
      if (promotions.length > 0) {
        result.set(casinodbId, promotions);
      }
    }

    return result;
  }

  /**
   * Count total promotions in map
   */
  private countTotalPromotions(
    promotionsMap: Map<number, Promotion[]>,
  ): number {
    let count = 0;
    for (const promotions of promotionsMap.values()) {
      count += promotions.length;
    }
    return count;
  }

  /**
   * Schedule research job with cron expression
   * Creates or updates a scheduled job
   */
  async scheduleResearch(
    jobName: string,
    cronExpression: string,
  ): Promise<ScheduledJob> {
    this.logger.log(
      `Scheduling research job: ${jobName} with cron: ${cronExpression}`,
    );

    try {
      parser.parse(cronExpression);
    } catch {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    const nextRun = this.calculateNextRun(cronExpression);

    const scheduledJob = await this.scheduledJobRepository.upsert(jobName, {
      schedule: cronExpression,
      nextRun,
      isActive: true,
    });

    this.logger.log(
      `Research job scheduled: ${jobName}. Next run: ${nextRun.toISOString()}`,
    );

    return scheduledJob;
  }

  /**
   * Calculate next run time based on cron expression
   */
  private calculateNextRun(cronExpression: string): Date {
    try {
      const interval = parser.parse(cronExpression);
      const nextDate = interval.next();
      return nextDate.toDate();
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Invalid cron expression: ${cronExpression}`, error);
      const nextDate = new Date();
      nextDate.setHours(nextDate.getHours() + 24);
      return nextDate;
    }
  }

  /**
   * Delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
