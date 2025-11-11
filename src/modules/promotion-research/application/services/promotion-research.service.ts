import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Casino } from '../../../shared/domain/entities/casino.entity';
import { ComparisonStatus } from '../../../shared/domain/enums/comparison-status.enum';
import { ComparisonType } from '../../../shared/domain/enums/comparison-type.enum';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';
import { ComparisonNotFoundException } from '../../../shared/domain/exceptions';
import { CasinoRepository } from '../../../shared/infrastructure/repositories/casino.repository';
import { PromotionComparison } from '../../domain/entities/promotion-comparison.entity';
import { Promotion } from '../../domain/entities/promotion.entity';
import { PromotionValue } from '../../domain/value-objects/promotion-value.vo';
import { PerplexitySonarClient } from '../../infrastructure/external-apis/perplexity/perplexity-sonar.client';
import { DiscoveredPromotion } from '../../infrastructure/external-apis/perplexity/perplexity-sonar.types';
import { PromotionComparisonRepository } from '../../infrastructure/repositories/promotion-comparison.repository';

/**
 * Promotion Research Service
 * Orchestrates promotion research using Perplexity Sonar API in batches
 * Compares discovered promotions against existing ones using traditional logic
 */
@Injectable()
export class PromotionResearchService {
  private readonly logger = new Logger(PromotionResearchService.name);

  constructor(
    private readonly perplexitySonarClient: PerplexitySonarClient,
    private readonly promotionComparisonRepository: PromotionComparisonRepository,
    private readonly casinoRepository: CasinoRepository,
  ) {}

  /**
   * Research promotions for a batch of casinos
   * Batches 5-10 casinos per Perplexity request
   * Includes existing promotions for context
   * Applies traditional comparison logic and filters expired/worse promotions
   */
  async researchPromotionsForCasinoBatch(
    casinos: Casino[],
    existingPromotions: Map<number, Promotion[]>,
  ): Promise<{
    processed: number;
    created: number;
    filtered: number;
    comparisons: PromotionComparison[];
  }> {
    this.logger.log(
      `Starting promotion research for batch of ${casinos.length} casinos`,
    );

    if (casinos.length === 0) {
      this.logger.warn('Empty casino batch provided');
      return {
        processed: 0,
        created: 0,
        filtered: 0,
        comparisons: [],
      };
    }

    try {
      const existingPromotionsMap = this.buildExistingPromotionsMap(
        casinos,
        existingPromotions,
      );

      const batchResult = await this.perplexitySonarClient.queryPromotionsBatch(
        casinos,
        existingPromotionsMap,
      );

      this.logger.log(
        `Found ${batchResult.promotions.length} promotions from Perplexity for batch`,
      );

      const comparisons: PromotionComparison[] = [];
      let filteredCount = 0;

      for (const discoveredPromo of batchResult.promotions) {
        const casino = casinos.find(
          (c) =>
            c.name.toLowerCase().trim() ===
            discoveredPromo.casinoName.toLowerCase().trim(),
        );

        if (!casino) {
          this.logger.warn(
            `Casino not found for promotion: ${discoveredPromo.casinoName}`,
          );
          continue;
        }

        const discoveredPromotion =
          this.mapDiscoveredToPromotion(discoveredPromo);

        const existingPromotion = this.findExistingPromotion(
          casino.casinodb_id,
          discoveredPromotion.offerType,
          existingPromotions,
        );

        if (
          PromotionValue.shouldFilterOut(discoveredPromotion, existingPromotion)
        ) {
          filteredCount++;
          this.logger.debug(
            `Filtered out promotion: ${discoveredPromo.offerName} for ${casino.name}`,
          );
          continue;
        }

        const comparisonType = PromotionValue.determineComparisonType(
          discoveredPromotion,
          existingPromotion,
        );

        const casinoDbId = await this.getCasinoDatabaseId(casino.casinodb_id);
        if (!casinoDbId) {
          this.logger.warn(
            `Casino not found in database: ${casino.name} (casinodb_id: ${casino.casinodb_id})`,
          );
          continue;
        }

        const comparison = await this.createPromotionComparison(
          casinoDbId,
          discoveredPromotion,
          existingPromotion,
          comparisonType,
          batchResult.citations,
        );

        comparisons.push(comparison);
      }

      this.logger.log(
        `Completed promotion research for batch: ${comparisons.length} created, ${filteredCount} filtered`,
      );

      return {
        processed: batchResult.promotions.length,
        created: comparisons.length,
        filtered: filteredCount,
        comparisons,
      };
    } catch (error) {
      this.logger.error(
        'Failed to research promotions for casino batch',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Compare discovered promotion against existing promotion
   * Uses traditional algorithm to determine comparison type
   */
  comparePromotions(
    discovered: Promotion,
    existing: Promotion | null,
  ): ComparisonType {
    return PromotionValue.determineComparisonType(discovered, existing);
  }

  /**
   * Get promotion comparisons with filters and offset-based pagination
   */
  async getPromotionComparisons(filters?: {
    casinoId?: string;
    state?: StateAbbreviation;
    offerType?: string;
    comparisonType?: ComparisonType;
    status?: ComparisonStatus;
    promotionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    comparisons: PromotionComparison[];
    total: number;
  }> {
    this.logger.debug('Fetching promotion comparisons with filters', filters);

    const comparisons =
      await this.promotionComparisonRepository.findAll(filters);
    const total = await this.promotionComparisonRepository.count({
      casinoId: filters?.casinoId,
      state: filters?.state,
      offerType: filters?.offerType,
      comparisonType: filters?.comparisonType,
      status: filters?.status,
    });

    return { comparisons, total };
  }

  /**
   * Update comparison status based on user action
   * Handles actions: update, add, ignore
   */
  async updateComparisonStatus(
    comparisonId: string,
    action: 'update' | 'add' | 'ignore',
    notes?: string,
  ): Promise<PromotionComparison> {
    this.logger.log(
      `Updating comparison ${comparisonId} with action: ${action}`,
    );

    const comparison =
      await this.promotionComparisonRepository.findById(comparisonId);

    if (!comparison) {
      throw new ComparisonNotFoundException(comparisonId);
    }

    let newStatus: ComparisonStatus;

    switch (action) {
      case 'update':
        newStatus = ComparisonStatus.UPDATED;
        break;
      case 'add':
        newStatus = ComparisonStatus.REVIEWED;
        break;
      case 'ignore':
        newStatus = ComparisonStatus.IGNORED;
        break;
      default:
        throw new BadRequestException(`Invalid action: ${action as string}`);
    }

    const updated = await this.promotionComparisonRepository.updateStatus(
      comparisonId,
      newStatus,
      notes,
    );

    this.logger.log(
      `Updated comparison ${comparisonId} to status: ${newStatus}`,
    );

    return updated;
  }

  /**
   * Build existing promotions map for Perplexity prompt
   * Maps casino names to their existing promotions
   */
  private buildExistingPromotionsMap(
    casinos: Casino[],
    existingPromotions: Map<number, Promotion[]>,
  ): Map<string, Promotion[]> {
    const map = new Map<string, Promotion[]>();

    for (const casino of casinos) {
      const promotions = existingPromotions.get(casino.casinodb_id) || [];
      map.set(casino.name, promotions);
    }

    return map;
  }

  /**
   * Find existing promotion for a casino and offer type
   */
  private findExistingPromotion(
    casinodbId: number,
    offerType: string,
    existingPromotions: Map<number, Promotion[]>,
  ): Promotion | null {
    const promotions = existingPromotions.get(casinodbId) || [];

    return (
      promotions.find(
        (p) => p.offerType.toLowerCase() === offerType.toLowerCase(),
      ) || null
    );
  }

  /**
   * Map discovered promotion from Perplexity to domain Promotion entity
   */
  private mapDiscoveredToPromotion(discovered: DiscoveredPromotion): Promotion {
    return Promotion.create({
      offerName: discovered.offerName,
      offerType: discovered.offerType,
      expectedDeposit: discovered.expectedDeposit,
      expectedBonus: discovered.expectedBonus,
      termsAndConditions: discovered.termsAndConditions,
      wageringRequirements: discovered.wageringRequirements,
      validUntil: discovered.validUntil
        ? new Date(discovered.validUntil)
        : undefined,
    });
  }

  /**
   * Get casino database ID by casinodb_id
   * Returns null if casino not found in database
   */
  private async getCasinoDatabaseId(
    casinodbId: number,
  ): Promise<string | null> {
    const casino = await this.casinoRepository.findByCasinoDbId(casinodbId);
    return casino?.id || null;
  }

  /**
   * Create promotion comparison record in database
   */
  private async createPromotionComparison(
    casinoId: string,
    discoveredPromotion: Promotion,
    existingPromotion: Promotion | null,
    comparisonType: ComparisonType,
    citations: string[],
  ): Promise<PromotionComparison> {
    const comparisonData = {
      casinoId,
      currentPromotion: existingPromotion,
      discoveredPromotion,
      comparisonType,
      status: ComparisonStatus.PENDING,
      sources: citations,
    };

    const created =
      await this.promotionComparisonRepository.create(comparisonData);

    this.logger.debug(
      `Created promotion comparison: ${created.id} (${comparisonType})`,
    );

    return created;
  }
}
