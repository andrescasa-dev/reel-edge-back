import { ComparisonType } from '../../../shared/domain/enums/comparison-type.enum';
import { Promotion } from '../entities/promotion.entity';

/**
 * Promotion Value Object
 * Encapsulates bonus comparison logic to determine which promotion is "better"
 * Uses traditional programming logic (no AI) for cost optimization
 */
export class PromotionValue {
  /**
   * Determine comparison type between discovered and existing promotion
   *
   * Rules:
   * - NEW: No existing promotion for casino+offer_type
   * - BETTER:
   *   - Bonus ratio >1% higher
   *   - Same bonus, lower deposit
   *   - Similar value, >20% lower wagering
   * - ALTERNATIVE: Everything else (default when uncertain)
   */
  static determineComparisonType(
    discovered: Promotion,
    existing: Promotion | null,
  ): ComparisonType {
    // If no existing promotion, it's new
    if (!existing) {
      return ComparisonType.NEW;
    }

    const discoveredRatio = discovered.getBonusRatio();
    const existingRatio = existing.getBonusRatio();

    // Rule 1: Better if bonus ratio is >1% higher
    if (discoveredRatio > existingRatio * 1.01) {
      return ComparisonType.BETTER;
    }

    // Rule 2: Better if same bonus but lower deposit
    if (
      discovered.expectedBonus === existing.expectedBonus &&
      discovered.expectedDeposit < existing.expectedDeposit
    ) {
      return ComparisonType.BETTER;
    }

    // Rule 3: Better if similar value but significantly lower wagering
    const ratiosAreSimilar = Math.abs(discoveredRatio - existingRatio) < 0.1;

    if (ratiosAreSimilar) {
      const discoveredWagering = this.parseWageringRequirement(
        discovered.wageringRequirements,
      );
      const existingWagering = this.parseWageringRequirement(
        existing.wageringRequirements,
      );

      if (
        discoveredWagering !== null &&
        existingWagering !== null &&
        discoveredWagering < existingWagering * 0.8
      ) {
        return ComparisonType.BETTER;
      }
    }

    // Default to alternative when uncertain
    return ComparisonType.ALTERNATIVE;
  }

  /**
   * Check if a discovered promotion should be filtered out
   *
   * Filter rules:
   * - Expired promotions (validUntil < now)
   * - Significantly worse promotions (>30% worse ratio)
   * - Keep "alternative" when uncertain
   */
  static shouldFilterOut(
    discovered: Promotion,
    existing: Promotion | null,
  ): boolean {
    // Filter expired promotions
    if (discovered.isExpired()) {
      return true;
    }

    // Don't filter if no existing promotion (new promotion)
    if (!existing) {
      return false;
    }

    // Filter if significantly worse (>30% worse ratio)
    const discoveredRatio = discovered.getBonusRatio();
    const existingRatio = existing.getBonusRatio();

    if (discoveredRatio < existingRatio * 0.7) {
      return true;
    }

    // Keep everything else (including alternatives)
    return false;
  }

  /**
   * Parse wagering requirement string to numeric multiplier
   * Examples: "30x" -> 30, "25x bonus" -> 25
   * Returns null if unable to parse
   */
  private static parseWageringRequirement(requirement?: string): number | null {
    if (!requirement) {
      return null;
    }

    const match = requirement.match(/(\d+)x/i);
    if (match) {
      return parseInt(match[1], 10);
    }

    return null;
  }

  /**
   * Calculate improvement percentage
   * Returns null if no existing promotion
   */
  static calculateImprovement(
    discovered: Promotion,
    existing: Promotion | null,
  ): number | null {
    if (!existing) {
      return null;
    }

    const discoveredRatio = discovered.getBonusRatio();
    const existingRatio = existing.getBonusRatio();

    if (existingRatio === 0) {
      return discoveredRatio > 0 ? 100 : 0;
    }

    return ((discoveredRatio - existingRatio) / existingRatio) * 100;
  }

  /**
   * Get detailed comparison explanation
   */
  static getComparisonExplanation(
    discovered: Promotion,
    existing: Promotion | null,
  ): string {
    const comparisonType = this.determineComparisonType(discovered, existing);

    if (comparisonType === ComparisonType.NEW) {
      return 'No existing promotion for this casino and offer type';
    }

    const improvement = this.calculateImprovement(discovered, existing);

    if (comparisonType === ComparisonType.BETTER) {
      if (improvement !== null && improvement > 10) {
        return `Bonus ratio improved by ${improvement.toFixed(1)}%`;
      }
      return 'Better terms compared to existing promotion';
    }

    return 'Alternative promotion with different terms';
  }
}
