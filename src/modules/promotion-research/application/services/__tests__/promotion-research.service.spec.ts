import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma/prisma.service';
import { PromotionComparisonRepository } from '../../../infrastructure/repositories/promotion-comparison.repository';
import { StateAbbreviation } from '../../../../shared/domain/enums/state.enum';
import { ComparisonType } from '../../../../shared/domain/enums/comparison-type.enum';
import { ComparisonStatus } from '../../../../shared/domain/enums/comparison-status.enum';
import { Casino } from '../../../../shared/domain/entities/casino.entity';
import { Promotion } from '../../../domain/entities/promotion.entity';
import { PromotionComparison } from '../../../domain/entities/promotion-comparison.entity';
import { ReelEdgeData } from '../../../../shared/infrastructure/external-apis/reel-edge/reel-edge.client';
import { PerplexitySonarClient } from '../../../infrastructure/external-apis/perplexity/perplexity-sonar.client';
import { DiscoveredPromotion } from '../../../infrastructure/external-apis/perplexity/perplexity-sonar.types';
import { PromotionResearchService } from '../promotion-research.service';
import { cleanDatabase } from '../../../../../../test/helpers/database-cleanup.helper';
import { ComparisonNotFoundException } from '../../../../shared/domain/exceptions';
import { CasinoRepository } from '../../../../shared/infrastructure/repositories/casino.repository';

describe('PromotionResearchService', () => {
  let service: PromotionResearchService;
  let perplexitySonarClient: jest.Mocked<PerplexitySonarClient>;
  let promotionComparisonRepository: PromotionComparisonRepository;
  let casinoRepository: CasinoRepository;
  let prismaService: PrismaService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL_TEST && process.env.NODE_ENV === 'test') {
      throw new Error(
        'DATABASE_URL_TEST must be set for tests to avoid running against development database',
      );
    }

    const mockPerplexitySonarClient = {
      queryPromotionsBatch: jest.fn(),
      getBatchSize: jest.fn().mockReturnValue(7),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionResearchService,
        {
          provide: PerplexitySonarClient,
          useValue: mockPerplexitySonarClient,
        },
        PromotionComparisonRepository,
        CasinoRepository,
        PrismaService,
      ],
    }).compile();

    service = module.get<PromotionResearchService>(PromotionResearchService);
    perplexitySonarClient = module.get(PerplexitySonarClient);
    promotionComparisonRepository = module.get<PromotionComparisonRepository>(
      PromotionComparisonRepository,
    );
    casinoRepository = module.get<CasinoRepository>(CasinoRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prismaService);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prismaService.$disconnect();
  });

  describe('comparePromotions', () => {
    it('should return NEW when no existing promotion', () => {
      const discovered = Promotion.create({
        offerName: 'Welcome Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
      });

      const result = service.comparePromotions(discovered, null);

      expect(result).toBe(ComparisonType.NEW);
    });

    it('should return BETTER when bonus ratio is >10% higher', () => {
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
        expectedBonus: 120,
      });

      const result = service.comparePromotions(discovered, existing);

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
        expectedDeposit: 80,
        expectedBonus: 200,
      });

      const result = service.comparePromotions(discovered, existing);

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
        expectedBonus: 201,
      });

      const result = service.comparePromotions(discovered, existing);

      expect(result).toBe(ComparisonType.ALTERNATIVE);
    });
  });

  describe('researchPromotionsForCasinoBatch', () => {
    let testCasino: Casino;
    let cachedReelEdgeData: ReelEdgeData;

    beforeEach(async () => {
      testCasino = await casinoRepository.create({
        casinodb_id: 1,
        name: 'Test Casino',
        state: StateAbbreviation.NJ,
        website: 'https://testcasino.com',
      });

      cachedReelEdgeData = {
        casinos: [testCasino],
        promotions: new Map(),
      };
    });

    it('should return empty result for empty casino batch', async () => {
      const result = await service.researchPromotionsForCasinoBatch(
        [],
        new Map(),
        cachedReelEdgeData,
      );

      expect(result.processed).toBe(0);
      expect(result.created).toBe(0);
      expect(result.filtered).toBe(0);
      expect(result.comparisons).toHaveLength(0);
      expect(perplexitySonarClient.queryPromotionsBatch).not.toHaveBeenCalled();
    });

    it('should research promotions and create comparisons for new promotions', async () => {
      const existingPromotions = new Map<number, Promotion[]>();

      const discoveredPromotions: DiscoveredPromotion[] = [
        {
          casinoName: 'Test Casino',
          offerName: 'Welcome Bonus',
          offerType: 'Deposit Bonus',
          expectedDeposit: 100,
          expectedBonus: 200,
          termsAndConditions: 'Terms apply',
          wageringRequirements: '30x',
        },
      ];

      perplexitySonarClient.queryPromotionsBatch.mockResolvedValue({
        promotions: discoveredPromotions,
        citations: ['https://source1.com'],
        casinos: ['Test Casino'],
      });

      const result = await service.researchPromotionsForCasinoBatch(
        [testCasino],
        existingPromotions,
        cachedReelEdgeData,
      );

      expect(result.processed).toBe(1);
      expect(result.created).toBe(1);
      expect(result.filtered).toBe(0);
      expect(result.comparisons).toHaveLength(1);
      expect(perplexitySonarClient.queryPromotionsBatch).toHaveBeenCalledTimes(
        1,
      );

      const comparison = result.comparisons[0];
      expect(comparison.comparisonType).toBe(ComparisonType.NEW);
      expect(comparison.status).toBe(ComparisonStatus.PENDING);
      expect(comparison.discoveredPromotion.offerName).toBe('Welcome Bonus');
    });

    it('should filter expired promotions', async () => {
      const existingPromotions = new Map<number, Promotion[]>();

      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      const discoveredPromotions: DiscoveredPromotion[] = [
        {
          casinoName: 'Test Casino',
          offerName: 'Expired Bonus',
          offerType: 'Deposit Bonus',
          expectedDeposit: 100,
          expectedBonus: 200,
          validUntil: expiredDate.toISOString(),
        },
      ];

      perplexitySonarClient.queryPromotionsBatch.mockResolvedValue({
        promotions: discoveredPromotions,
        citations: [],
        casinos: ['Test Casino'],
      });

      const result = await service.researchPromotionsForCasinoBatch(
        [testCasino],
        existingPromotions,
        cachedReelEdgeData,
      );

      expect(result.processed).toBe(1);
      expect(result.created).toBe(0);
      expect(result.filtered).toBe(1);
      expect(result.comparisons).toHaveLength(0);
    });

    it('should filter worse promotions (>30% worse ratio)', async () => {
      const existingPromotion = Promotion.create({
        offerName: 'Good Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
      });

      const existingPromotions = new Map<number, Promotion[]>([
        [testCasino.casinodb_id, [existingPromotion]],
      ]);

      const discoveredPromotions: DiscoveredPromotion[] = [
        {
          casinoName: 'Test Casino',
          offerName: 'Worse Bonus',
          offerType: 'Deposit Bonus',
          expectedDeposit: 100,
          expectedBonus: 120,
        },
      ];

      perplexitySonarClient.queryPromotionsBatch.mockResolvedValue({
        promotions: discoveredPromotions,
        citations: [],
        casinos: ['Test Casino'],
      });

      const result = await service.researchPromotionsForCasinoBatch(
        [testCasino],
        existingPromotions,
        cachedReelEdgeData,
      );

      expect(result.processed).toBe(1);
      expect(result.created).toBe(0);
      expect(result.filtered).toBe(1);
      expect(result.comparisons).toHaveLength(0);
    });

    it('should create BETTER comparison when bonus ratio is >10% higher', async () => {
      const existingPromotion = Promotion.create({
        offerName: 'Old Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 100,
      });

      const existingPromotions = new Map<number, Promotion[]>([
        [testCasino.casinodb_id, [existingPromotion]],
      ]);

      const discoveredPromotions: DiscoveredPromotion[] = [
        {
          casinoName: 'Test Casino',
          offerName: 'Better Bonus',
          offerType: 'Deposit Bonus',
          expectedDeposit: 100,
          expectedBonus: 120,
        },
      ];

      perplexitySonarClient.queryPromotionsBatch.mockResolvedValue({
        promotions: discoveredPromotions,
        citations: ['https://source1.com'],
        casinos: ['Test Casino'],
      });

      const result = await service.researchPromotionsForCasinoBatch(
        [testCasino],
        existingPromotions,
        cachedReelEdgeData,
      );

      expect(result.processed).toBe(1);
      expect(result.created).toBe(1);
      expect(result.filtered).toBe(0);
      expect(result.comparisons).toHaveLength(1);

      const comparison = result.comparisons[0];
      expect(comparison.comparisonType).toBe(ComparisonType.BETTER);
      expect(comparison.currentPromotion).not.toBeNull();
    });

    it('should handle multiple promotions in batch', async () => {
      const casino2 = await casinoRepository.create({
        casinodb_id: 2,
        name: 'Test Casino 2',
        state: StateAbbreviation.NJ,
      });

      const existingPromotions = new Map<number, Promotion[]>();

      const discoveredPromotions: DiscoveredPromotion[] = [
        {
          casinoName: 'Test Casino',
          offerName: 'Welcome Bonus 1',
          offerType: 'Deposit Bonus',
          expectedDeposit: 100,
          expectedBonus: 200,
        },
        {
          casinoName: 'Test Casino 2',
          offerName: 'Welcome Bonus 2',
          offerType: 'Deposit Bonus',
          expectedDeposit: 100,
          expectedBonus: 200,
        },
      ];

      perplexitySonarClient.queryPromotionsBatch.mockResolvedValue({
        promotions: discoveredPromotions,
        citations: ['https://source1.com'],
        casinos: ['Test Casino', 'Test Casino 2'],
      });

      const result = await service.researchPromotionsForCasinoBatch(
        [testCasino, casino2],
        existingPromotions,
        cachedReelEdgeData,
      );

      expect(result.processed).toBe(2);
      expect(result.created).toBe(2);
      expect(result.filtered).toBe(0);
      expect(result.comparisons).toHaveLength(2);
    });

    it('should handle Perplexity API errors gracefully', async () => {
      perplexitySonarClient.queryPromotionsBatch.mockRejectedValue(
        new Error('Perplexity API error'),
      );

      await expect(
        service.researchPromotionsForCasinoBatch(
          [testCasino],
          new Map(),
          cachedReelEdgeData,
        ),
      ).rejects.toThrow();
    });
  });

  describe('getPromotionComparisons', () => {
    let testCasino: Casino;
    let comparison: PromotionComparison;

    beforeEach(async () => {
      testCasino = await casinoRepository.create({
        casinodb_id: 1,
        name: 'Test Casino',
        state: StateAbbreviation.NJ,
      });

      const discoveredPromotion = Promotion.create({
        offerName: 'Welcome Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
      });

      comparison = await promotionComparisonRepository.create({
        casinoId: testCasino.id,
        currentPromotion: null,
        discoveredPromotion,
        comparisonType: ComparisonType.NEW,
        status: ComparisonStatus.PENDING,
        sources: ['https://source1.com'],
      });
    });

    it('should return all comparisons without filters', async () => {
      const result = await service.getPromotionComparisons();

      expect(result.comparisons.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const result = await service.getPromotionComparisons({
        status: ComparisonStatus.PENDING,
      });

      expect(result.comparisons.every((c) => c.status === ComparisonStatus.PENDING)).toBe(
        true,
      );
    });

    it('should filter by comparison type', async () => {
      const result = await service.getPromotionComparisons({
        comparisonType: ComparisonType.NEW,
      });

      expect(
        result.comparisons.every((c) => c.comparisonType === ComparisonType.NEW),
      ).toBe(true);
    });

    it('should filter by state', async () => {
      const result = await service.getPromotionComparisons({
        state: StateAbbreviation.NJ,
      });

      expect(
        result.comparisons.every((c) => c.casinoId === testCasino.id),
      ).toBe(true);
    });

    it('should support pagination with limit and offset', async () => {
      const result1 = await service.getPromotionComparisons({
        limit: 1,
        offset: 0,
      });

      const result2 = await service.getPromotionComparisons({
        limit: 1,
        offset: 1,
      });

      expect(result1.comparisons).toHaveLength(1);
      expect(result2.comparisons.length).toBeGreaterThanOrEqual(0);
      expect(result1.comparisons[0]?.id).not.toBe(result2.comparisons[0]?.id);
    });
  });

  describe('updateComparisonStatus', () => {
    let testCasino: Casino;
    let comparison: PromotionComparison;

    beforeEach(async () => {
      testCasino = await casinoRepository.create({
        casinodb_id: 1,
        name: 'Test Casino',
        state: StateAbbreviation.NJ,
      });

      const discoveredPromotion = Promotion.create({
        offerName: 'Welcome Bonus',
        offerType: 'Deposit Bonus',
        expectedDeposit: 100,
        expectedBonus: 200,
      });

      comparison = await promotionComparisonRepository.create({
        casinoId: testCasino.id,
        currentPromotion: null,
        discoveredPromotion,
        comparisonType: ComparisonType.NEW,
        status: ComparisonStatus.PENDING,
        sources: ['https://source1.com'],
      });
    });

    it('should update status to UPDATED for update action', async () => {
      const updated = await service.updateComparisonStatus(
        comparison.id,
        'update',
        'Updated promotion',
      );

      expect(updated.status).toBe(ComparisonStatus.UPDATED);
      expect(updated.notes).toBe('Updated promotion');
    });

    it('should update status to REVIEWED for add action', async () => {
      const updated = await service.updateComparisonStatus(
        comparison.id,
        'add',
      );

      expect(updated.status).toBe(ComparisonStatus.REVIEWED);
    });

    it('should update status to IGNORED for ignore action', async () => {
      const updated = await service.updateComparisonStatus(
        comparison.id,
        'ignore',
        'Not relevant',
      );

      expect(updated.status).toBe(ComparisonStatus.IGNORED);
      expect(updated.notes).toBe('Not relevant');
    });

    it('should throw error when comparison not found', async () => {
      await expect(
        service.updateComparisonStatus('non-existent-id', 'update'),
      ).rejects.toThrow(ComparisonNotFoundException);
    });

    it('should throw error for invalid action', async () => {
      await expect(
        service.updateComparisonStatus(
          comparison.id,
          'invalid' as 'update' | 'add' | 'ignore',
        ),
      ).rejects.toThrow('Invalid action');
    });
  });
});

