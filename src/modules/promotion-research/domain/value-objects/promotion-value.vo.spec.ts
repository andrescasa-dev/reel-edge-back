import { ComparisonType } from '../../../shared/domain/enums/comparison-type.enum';
import { Promotion } from '../entities/promotion.entity';
import { PromotionValue } from './promotion-value.vo';

describe('PromotionValue Value Object', () => {
  describe('determineComparisonType', () => {
    it('should return NEW when no existing promotion', () => {
      const discovered = Promotion.create({
        offerName: 'Welcome Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
      });

      const result = PromotionValue.determineComparisonType(discovered, null);

      expect(result).toBe(ComparisonType.NEW);
    });

    it('should return BETTER when bonus ratio is >1% higher', () => {
      const existing = Promotion.create({
        offerName: 'Old Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 100, // 1:1 ratio
      });

      const discovered = Promotion.create({
        offerName: 'New Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 102, // 1.02:1 ratio (2% better)
      });

      const result = PromotionValue.determineComparisonType(
        discovered,
        existing,
      );

      expect(result).toBe(ComparisonType.BETTER);
    });

    it('should return BETTER when same bonus but lower deposit', () => {
      const existing = Promotion.create({
        offerName: 'Old Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
      });

      const discovered = Promotion.create({
        offerName: 'New Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 80, // Lower deposit, same bonus
        expectedBonus: 200,
      });

      const result = PromotionValue.determineComparisonType(
        discovered,
        existing,
      );

      expect(result).toBe(ComparisonType.BETTER);
    });

    it('should return BETTER when similar ratio but >20% lower wagering', () => {
      const existing = Promotion.create({
        offerName: 'Old Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
        wageringRequirements: '50x',
      });

      const discovered = Promotion.create({
        offerName: 'New Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
        wageringRequirements: '30x', // 40% lower wagering
      });

      const result = PromotionValue.determineComparisonType(
        discovered,
        existing,
      );

      expect(result).toBe(ComparisonType.BETTER);
    });

    it('should return ALTERNATIVE for marginal improvements', () => {
      const existing = Promotion.create({
        offerName: 'Old Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
      });

      const discovered = Promotion.create({
        offerName: 'New Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 201, // Only 0.5% better
      });

      const result = PromotionValue.determineComparisonType(
        discovered,
        existing,
      );

      expect(result).toBe(ComparisonType.ALTERNATIVE);
    });
  });

  describe('shouldFilterOut', () => {
    it('should filter expired promotions', () => {
      const expired = Promotion.create({
        offerName: 'Expired Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
        validUntil: new Date('2020-01-01'),
      });

      const result = PromotionValue.shouldFilterOut(expired, null);

      expect(result).toBe(true);
    });

    it('should filter promotions >30% worse', () => {
      const existing = Promotion.create({
        offerName: 'Good Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
      });

      const discovered = Promotion.create({
        offerName: 'Worse Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 120, // 40% worse
      });

      const result = PromotionValue.shouldFilterOut(discovered, existing);

      expect(result).toBe(true);
    });

    it('should not filter new promotions', () => {
      const discovered = Promotion.create({
        offerName: 'New Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 100,
      });

      const result = PromotionValue.shouldFilterOut(discovered, null);

      expect(result).toBe(false);
    });

    it('should not filter alternative promotions', () => {
      const existing = Promotion.create({
        offerName: 'Existing Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
      });

      const discovered = Promotion.create({
        offerName: 'Alternative Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 180, // 10% worse but not >30%
      });

      const result = PromotionValue.shouldFilterOut(discovered, existing);

      expect(result).toBe(false);
    });
  });

  describe('calculateImprovement', () => {
    it('should return null for new promotions', () => {
      const discovered = Promotion.create({
        offerName: 'New Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
      });

      const result = PromotionValue.calculateImprovement(discovered, null);

      expect(result).toBeNull();
    });

    it('should calculate improvement percentage', () => {
      const existing = Promotion.create({
        offerName: 'Old Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 100,
      });

      const discovered = Promotion.create({
        offerName: 'New Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 150,
      });

      const result = PromotionValue.calculateImprovement(discovered, existing);

      expect(result).toBe(50); // 50% improvement
    });
  });
});
