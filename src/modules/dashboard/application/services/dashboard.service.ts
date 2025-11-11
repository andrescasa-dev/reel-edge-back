import { Injectable, Logger } from '@nestjs/common';
import { MissingCasinoRepository } from '../../../casino-discovery/infrastructure/repositories/missing-casino.repository';
import { PromotionComparisonRepository } from '../../../promotion-research/infrastructure/repositories/promotion-comparison.repository';
import { ResearchOrchestrationService } from '../../../research-orchestration/application/services/research-orchestration.service';
import { ComparisonStatus } from '../../../shared/domain/enums/comparison-status.enum';
import { ResearchStatus } from '../../../shared/domain/enums/research-status.enum';
import {
  getAllStates,
  STATE_NAMES,
  StateAbbreviation,
} from '../../../shared/domain/enums/state.enum';
import {
  ReelEdgeDBClient,
  ReelEdgeData,
} from '../../../shared/infrastructure/external-apis/reel-edge/reel-edge.client';

/**
 * State statistics interface
 */
export interface StateStats {
  state: {
    Abbreviation: StateAbbreviation;
    Name: string;
  };
  casinosTracked: number;
  promotionsActive: number;
  lastUpdated: Date;
  status: ResearchStatus;
  missingCasinos?: number;
  pendingComparisons?: number;
}

/**
 * Dashboard Service
 * Aggregates statistics from multiple data sources and manages research status
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly researchOrchestrationService: ResearchOrchestrationService,
    private readonly reelEdgeClient: ReelEdgeDBClient,
    private readonly missingCasinoRepository: MissingCasinoRepository,
    private readonly promotionComparisonRepository: PromotionComparisonRepository,
  ) {}

  /**
   * Get state-level statistics for all states
   * Aggregates data from Reel Edge DB, missing casinos, and promotion comparisons
   */
  async getStateStats(): Promise<StateStats[]> {
    this.logger.log('Fetching state statistics');

    const globalStatus = this.researchOrchestrationService.getResearchStatus();
    const states = getAllStates();

    try {
      const reelEdgeData = await this.reelEdgeClient.fetchAllActiveData();
      const statsPromises = states.map((state) =>
        this.getStateStatsForState(state, reelEdgeData, globalStatus),
      );

      const stats = await Promise.all(statsPromises);

      this.logger.log(
        `Successfully fetched statistics for ${stats.length} states`,
      );

      return stats;
    } catch (error) {
      this.logger.error('Failed to fetch state statistics', error);
      throw error;
    }
  }

  /**
   * Get statistics for a single state
   */
  private async getStateStatsForState(
    state: StateAbbreviation,
    reelEdgeData: ReelEdgeData,
    globalStatus: ResearchStatus,
  ): Promise<StateStats> {
    const stateCasinos = reelEdgeData.casinos.filter(
      (casino) => casino.state === state,
    );

    let statePromotionsCount = 0;
    for (const casino of stateCasinos) {
      const promotions = reelEdgeData.promotions.get(casino.casinodb_id) || [];
      statePromotionsCount += promotions.length;
    }

    const missingCasinosCount = await this.missingCasinoRepository.count({
      state,
    });

    const pendingComparisonsCount =
      await this.promotionComparisonRepository.count({
        state,
        status: ComparisonStatus.PENDING,
      });

    const lastUpdated = new Date();

    return {
      state: {
        Abbreviation: state,
        Name: STATE_NAMES[state],
      },
      casinosTracked: stateCasinos.length,
      promotionsActive: statePromotionsCount,
      lastUpdated,
      status: globalStatus,
      missingCasinos: missingCasinosCount,
      pendingComparisons: pendingComparisonsCount,
    };
  }

  /**
   * Start research for all states
   * Executes the research process asynchronously in the background
   * Returns immediately without waiting for the process to complete
   */
  startResearch(): Promise<{
    success: boolean;
    message: string;
    status: ResearchStatus;
  }> {
    this.logger.log('Starting research via dashboard service');

    // Check if research is already in progress
    const currentStatus = this.researchOrchestrationService.getResearchStatus();
    if (currentStatus === ResearchStatus.RESEARCHING) {
      this.logger.warn('Research already in progress');
      return Promise.resolve({
        success: true,
        message: 'Research is already in progress',
        status: ResearchStatus.RESEARCHING,
      });
    }

    // Start the research process asynchronously in the background
    // Don't await - let it run in the background
    this.researchOrchestrationService
      .startFullResearch()
      .then(() => {
        this.logger.log('Research process completed successfully');
      })
      .catch((error) => {
        // Handle errors in background - only log, don't throw
        // The process will update status to IDLE in its finally block
        this.logger.error('Research process failed in background', error);
      });

    // Return immediately
    return Promise.resolve({
      success: true,
      message: 'Research started successfully',
      status: ResearchStatus.RESEARCHING,
    });
  }

  /**
   * Stop ongoing research
   */
  async stopResearch(): Promise<{
    success: boolean;
    message: string;
    status: ResearchStatus;
  }> {
    this.logger.log('Stopping research via dashboard service');

    try {
      await this.researchOrchestrationService.stopResearch();

      return {
        success: true,
        message: 'Research stopped successfully',
        status: ResearchStatus.IDLE,
      };
    } catch (error) {
      this.logger.error('Failed to stop research', error);
      throw error;
    }
  }

  /**
   * Get current research status
   */
  getResearchStatus(): ResearchStatus {
    return this.researchOrchestrationService.getResearchStatus();
  }
}
