import { ComparisonType } from '../../../shared/domain/enums/comparison-type.enum';
import { ComparisonStatus } from '../../../shared/domain/enums/comparison-status.enum';
import { Promotion } from './promotion.entity';

/**
 * Promotion Comparison domain entity
 * Represents a comparison between an existing and discovered promotion
 */
export class PromotionComparison {
  constructor(
    public readonly id: string,
    public readonly casinoId: string,
    public readonly currentPromotion: Promotion | null,
    public readonly discoveredPromotion: Promotion,
    public readonly comparisonType: ComparisonType,
    public readonly status: ComparisonStatus,
    public readonly sources: string[],
    public readonly notes?: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
  ) {}

  /**
   * Create a PromotionComparison entity from data object
   */
  static create(data: {
    id?: string;
    casinoId: string;
    currentPromotion: Promotion | null;
    discoveredPromotion: Promotion;
    comparisonType: ComparisonType;
    status?: ComparisonStatus;
    sources: string[];
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): PromotionComparison {
    return new PromotionComparison(
      data.id || '',
      data.casinoId,
      data.currentPromotion,
      data.discoveredPromotion,
      data.comparisonType,
      data.status || ComparisonStatus.PENDING,
      data.sources,
      data.notes,
      data.createdAt || new Date(),
      data.updatedAt || new Date(),
    );
  }

  /**
   * Check if comparison is new (no current promotion)
   */
  isNew(): boolean {
    return this.comparisonType === ComparisonType.NEW;
  }

  /**
   * Check if discovered promotion is better
   */
  isBetter(): boolean {
    return this.comparisonType === ComparisonType.BETTER;
  }

  /**
   * Check if comparison is still pending
   */
  isPending(): boolean {
    return this.status === ComparisonStatus.PENDING;
  }

  /**
   * Check if comparison has been acted upon
   */
  isActedUpon(): boolean {
    return this.status !== ComparisonStatus.PENDING;
  }

  /**
   * Update status
   */
  updateStatus(
    newStatus: ComparisonStatus,
    notes?: string,
  ): PromotionComparison {
    return new PromotionComparison(
      this.id,
      this.casinoId,
      this.currentPromotion,
      this.discoveredPromotion,
      this.comparisonType,
      newStatus,
      this.sources,
      notes || this.notes,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Get bonus improvement percentage
   * Returns null if no current promotion
   */
  getBonusImprovement(): number | null {
    if (!this.currentPromotion) {
      return null;
    }

    const currentRatio = this.currentPromotion.getBonusRatio();
    const discoveredRatio = this.discoveredPromotion.getBonusRatio();

    if (currentRatio === 0) {
      return discoveredRatio > 0 ? 100 : 0;
    }

    return ((discoveredRatio - currentRatio) / currentRatio) * 100;
  }

  /**
   * Convert to plain object
   */
  toObject(): {
    id: string;
    casinoId: string;
    currentPromotion: object | null;
    discoveredPromotion: object;
    comparisonType: ComparisonType;
    status: ComparisonStatus;
    sources: string[];
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
  } {
    return {
      id: this.id,
      casinoId: this.casinoId,
      currentPromotion: this.currentPromotion?.toObject() || null,
      discoveredPromotion: this.discoveredPromotion.toObject(),
      comparisonType: this.comparisonType,
      status: this.status,
      sources: this.sources,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
