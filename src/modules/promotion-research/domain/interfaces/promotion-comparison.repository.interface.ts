import { PromotionComparison } from '../entities/promotion-comparison.entity';
import { ComparisonType } from '../../../shared/domain/enums/comparison-type.enum';
import { ComparisonStatus } from '../../../shared/domain/enums/comparison-status.enum';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';

/**
 * Promotion Comparison Repository Interface
 * Defines contract for promotion comparison data persistence
 */
export interface IPromotionComparisonRepository {
  findById(id: string): Promise<PromotionComparison | null>;

  /**
   * Find all promotion comparisons with complex filters and offset-based pagination
   */
  findAll(filters?: {
    casinoId?: string;
    state?: StateAbbreviation;
    offerType?: string;
    comparisonType?: ComparisonType;
    status?: ComparisonStatus;
    promotionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PromotionComparison[]>;

  findByCasino(casinoId: string): Promise<PromotionComparison[]>;

  findByStatus(status: ComparisonStatus): Promise<PromotionComparison[]>;

  findByComparisonType(
    comparisonType: ComparisonType,
  ): Promise<PromotionComparison[]>;

  create(
    comparison: Omit<PromotionComparison, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<PromotionComparison>;

  update(
    id: string,
    data: Partial<PromotionComparison>,
  ): Promise<PromotionComparison>;

  updateStatus(
    id: string,
    status: ComparisonStatus,
    notes?: string,
  ): Promise<PromotionComparison>;

  delete(id: string): Promise<void>;

  count(filters?: {
    casinoId?: string;
    state?: StateAbbreviation;
    offerType?: string;
    comparisonType?: ComparisonType;
    status?: ComparisonStatus;
  }): Promise<number>;

  countByStatus(status: ComparisonStatus): Promise<number>;

  countByComparisonType(comparisonType: ComparisonType): Promise<number>;

  existsForCasinoAndOffer(
    casinoId: string,
    offerName: string,
  ): Promise<boolean>;
}
