import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { cleanDatabase } from '../helpers/database-cleanup.helper';
import { PrismaService } from '../../src/modules/shared/infrastructure/database/prisma/prisma.service';
import { HttpExceptionFilter } from '../../src/modules/shared/presentation/filters/http-exception.filter';
import {
  ReelEdgeDBClient,
  ReelEdgeData,
} from '../../src/modules/shared/infrastructure/external-apis/reel-edge/reel-edge.client';
import { PerplexitySearchClient } from '../../src/modules/casino-discovery/infrastructure/external-apis/perplexity/perplexity-search.client';
import { PerplexitySonarClient } from '../../src/modules/promotion-research/infrastructure/external-apis/perplexity/perplexity-sonar.client';
import { StateAbbreviation } from '../../src/modules/shared/domain/enums/state.enum';
import { ComparisonStatus } from '../../src/modules/shared/domain/enums/comparison-status.enum';
import { Casino } from '../../src/modules/shared/domain/entities/casino.entity';
import { Promotion } from '../../src/modules/promotion-research/domain/entities/promotion.entity';
import { DiscoveredCasino } from '../../src/modules/casino-discovery/infrastructure/external-apis/perplexity/perplexity-search.types';
import {
  DiscoveredPromotion,
  BatchResearchResult,
} from '../../src/modules/promotion-research/infrastructure/external-apis/perplexity/perplexity-sonar.types';
import { ResearchStatusResponseDto } from '../../src/modules/dashboard/presentation/dtos/start-research.dto';
import { UpdateComparisonResponseDto } from '../../src/modules/promotion-research/presentation/dtos/promotion-comparison-response.dto';

describe('Research Workflow (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let reelEdgeClient: ReelEdgeDBClient;
  let perplexitySearchClient: PerplexitySearchClient;
  let perplexitySonarClient: PerplexitySonarClient;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL_TEST) {
      throw new Error(
        'DATABASE_URL_TEST must be set for e2e tests to avoid running against development database',
      );
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    reelEdgeClient = moduleFixture.get<ReelEdgeDBClient>(ReelEdgeDBClient);
    perplexitySearchClient = moduleFixture.get<PerplexitySearchClient>(
      PerplexitySearchClient,
    );
    perplexitySonarClient = moduleFixture.get<PerplexitySonarClient>(
      PerplexitySonarClient,
    );
  });

  beforeEach(async () => {
    await cleanDatabase(prismaService);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prismaService.$disconnect();
    await app.close();
  });

  describe('Full Research Workflow', () => {
    it('should complete full research workflow: discovery + promotion research with batching', async () => {
      const mockCasinos: Casino[] = [
        Casino.create({
          casinodb_id: 1,
          name: 'Test Casino NJ',
          state: StateAbbreviation.NJ,
          website: 'https://testcasino.com',
          regulatoryId: 'NJ-001',
        }),
        Casino.create({
          casinodb_id: 2,
          name: 'Test Casino MI',
          state: StateAbbreviation.MI,
          website: 'https://testcasino2.com',
          regulatoryId: 'MI-001',
        }),
      ];

      const mockPromotions = new Map<number, Promotion[]>();
      mockPromotions.set(1, [
        Promotion.create({
          offerName: 'Welcome Bonus',
          offerType: 'Deposit Bonus',
          expectedDeposit: 100,
          expectedBonus: 50,
          termsAndConditions: 'Standard terms',
          wageringRequirements: '20x',
          validFrom: new Date('2024-01-01'),
          validUntil: new Date('2024-12-31'),
        }),
      ]);

      const mockReelEdgeData: ReelEdgeData = {
        casinos: mockCasinos,
        promotions: mockPromotions,
      };

      const mockDiscoveredCasinos: DiscoveredCasino[] = [
        {
          name: 'New Casino Discovery',
          website: 'https://newcasino.com',
          regulatoryId: 'NJ-002',
          state: StateAbbreviation.NJ,
        },
      ];

      const mockDiscoveredPromotions: DiscoveredPromotion[] = [
        {
          offerName: 'Better Welcome Bonus',
          offerType: 'Deposit Bonus',
          expectedDeposit: 100,
          expectedBonus: 75,
          wageringRequirements: '15x',
          termsAndConditions: 'Better terms',
          validUntil: '2024-12-31',
          casinoName: 'Test Casino NJ',
        },
        {
          offerName: 'New Promotion',
          offerType: 'No Deposit Bonus',
          expectedDeposit: 0,
          expectedBonus: 25,
          wageringRequirements: '30x',
          termsAndConditions: 'New terms',
          validUntil: '2024-12-31',
          casinoName: 'Test Casino MI',
        },
      ];

      jest
        .spyOn(reelEdgeClient, 'fetchAllActiveData')
        .mockResolvedValue(mockReelEdgeData);

      jest.spyOn(perplexitySearchClient, 'searchCasinos').mockResolvedValue({
        casinos: mockDiscoveredCasinos,
        searchResults: [
          {
            title: 'New Jersey Gaming Commission',
            url: 'https://nj.gov/gaming',
            snippet:
              'Licensed casinos: Test Casino NJ, New Casino Discovery, Another Casino',
          },
        ],
      });

      const mockBatchResult: BatchResearchResult = {
        promotions: mockDiscoveredPromotions,
        citations: ['https://testcasino.com/promotions'],
        casinos: ['Test Casino NJ', 'Test Casino MI'],
      };

      jest
        .spyOn(perplexitySonarClient, 'queryPromotionsBatch')
        .mockResolvedValue(mockBatchResult);

      const startResponse = await request(app.getHttpServer())
        .post('/dashboard/research-status')
        .send({ action: 'start' })
        .expect(200);

      const startBody = startResponse.body as ResearchStatusResponseDto;
      expect(startBody.success).toBe(true);
      expect(startBody.status).toBe('researching');

      await new Promise((resolve) => setTimeout(resolve, 5000));

      const researchJobs = await prismaService.researchJob.findMany();
      expect(researchJobs.length).toBeGreaterThan(0);

      const completedJob = researchJobs.find(
        (job) => job.status === 'completed',
      );
      expect(completedJob).toBeDefined();

      const missingCasinos = await prismaService.missingCasino.findMany();
      expect(missingCasinos.length).toBeGreaterThan(0);
      expect(missingCasinos[0].name).toBe('New Casino Discovery');

      const comparisons = await prismaService.promotionComparison.findMany();
      expect(comparisons.length).toBeGreaterThan(0);

      const betterComparison = comparisons.find(
        (c) => c.comparisonType === 'better',
      );
      expect(betterComparison).toBeDefined();
      expect(betterComparison?.discoveredExpectedBonus).toBe(75);

      const newComparison = comparisons.find((c) => c.comparisonType === 'new');
      expect(newComparison).toBeDefined();

      expect(
        (reelEdgeClient.fetchAllActiveData as jest.Mock).mock.calls.length,
      ).toBe(1);
    });

    it('should verify batching behavior (5-10 casinos per request)', async () => {
      const mockCasinos: Casino[] = Array.from({ length: 12 }, (_, i) =>
        Casino.create({
          casinodb_id: i + 1,
          name: `Test Casino ${i + 1}`,
          state: StateAbbreviation.NJ,
          website: `https://casino${i + 1}.com`,
          regulatoryId: `NJ-${String(i + 1).padStart(3, '0')}`,
        }),
      );

      const mockReelEdgeData: ReelEdgeData = {
        casinos: mockCasinos,
        promotions: new Map<number, Promotion[]>(),
      };

      jest
        .spyOn(reelEdgeClient, 'fetchAllActiveData')
        .mockResolvedValue(mockReelEdgeData);

      jest.spyOn(perplexitySearchClient, 'searchCasinos').mockResolvedValue({
        casinos: [],
        searchResults: [],
      });

      const batchPromotions: DiscoveredPromotion[] = Array.from(
        { length: 12 },
        (_, i) => ({
          offerName: `Promotion ${i + 1}`,
          offerType: 'Deposit Bonus',
          expectedDeposit: 100,
          expectedBonus: 50,
          wageringRequirements: '20x',
          termsAndConditions: 'Terms',
          validUntil: '2024-12-31',
          casinoName: `Test Casino ${i + 1}`,
        }),
      );

      const mockBatchResult: BatchResearchResult = {
        promotions: batchPromotions,
        citations: [],
        casinos: mockCasinos.map((c) => c.name),
      };

      jest
        .spyOn(perplexitySonarClient, 'queryPromotionsBatch')
        .mockResolvedValue(mockBatchResult);

      await request(app.getHttpServer())
        .post('/dashboard/research-status')
        .send({ action: 'start' })
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 5000));

      const batchCallCount = (
        perplexitySonarClient.queryPromotionsBatch as jest.Mock
      ).mock.calls.length;

      expect(batchCallCount).toBeGreaterThan(0);
      expect(batchCallCount).toBeLessThanOrEqual(3);

      const lastCallArgs = (
        perplexitySonarClient.queryPromotionsBatch as jest.Mock
      ).mock.calls[batchCallCount - 1] as [string[]];
      const casinosInLastBatch: string[] = lastCallArgs[0];
      expect(casinosInLastBatch.length).toBeGreaterThanOrEqual(5);
      expect(casinosInLastBatch.length).toBeLessThanOrEqual(10);
    });

    it('should verify single Reel Edge fetch per research job', async () => {
      const mockCasinos: Casino[] = [
        Casino.create({
          casinodb_id: 1,
          name: 'Test Casino',
          state: StateAbbreviation.NJ,
          website: 'https://test.com',
          regulatoryId: 'NJ-001',
        }),
      ];

      const mockReelEdgeData: ReelEdgeData = {
        casinos: mockCasinos,
        promotions: new Map<number, Promotion[]>(),
      };

      jest
        .spyOn(reelEdgeClient, 'fetchAllActiveData')
        .mockResolvedValue(mockReelEdgeData);

      jest.spyOn(perplexitySearchClient, 'searchCasinos').mockResolvedValue({
        casinos: [],
        searchResults: [],
      });

      const mockBatchResult: BatchResearchResult = {
        promotions: [],
        citations: [],
        casinos: [],
      };

      jest
        .spyOn(perplexitySonarClient, 'queryPromotionsBatch')
        .mockResolvedValue(mockBatchResult);

      await request(app.getHttpServer())
        .post('/dashboard/research-status')
        .send({ action: 'start' })
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 5000));

      expect(
        (reelEdgeClient.fetchAllActiveData as jest.Mock).mock.calls.length,
      ).toBe(1);
    });

    it('should update comparison status and persist changes', async () => {
      const mockCasinos: Casino[] = [
        Casino.create({
          casinodb_id: 1,
          name: 'Test Casino',
          state: StateAbbreviation.NJ,
          website: 'https://test.com',
          regulatoryId: 'NJ-001',
        }),
      ];

      const mockReelEdgeData: ReelEdgeData = {
        casinos: mockCasinos,
        promotions: new Map<number, Promotion[]>(),
      };

      jest
        .spyOn(reelEdgeClient, 'fetchAllActiveData')
        .mockResolvedValue(mockReelEdgeData);

      jest.spyOn(perplexitySearchClient, 'searchCasinos').mockResolvedValue({
        casinos: [],
        searchResults: [],
      });

      const mockDiscoveredPromotions: DiscoveredPromotion[] = [
        {
          offerName: 'New Promotion',
          offerType: 'Deposit Bonus',
          expectedDeposit: 100,
          expectedBonus: 50,
          wageringRequirements: '20x',
          termsAndConditions: 'Terms',
          validUntil: '2024-12-31',
          casinoName: 'Test Casino',
        },
      ];

      const mockBatchResult: BatchResearchResult = {
        promotions: mockDiscoveredPromotions,
        citations: [],
        casinos: ['Test Casino'],
      };

      jest
        .spyOn(perplexitySonarClient, 'queryPromotionsBatch')
        .mockResolvedValue(mockBatchResult);

      await request(app.getHttpServer())
        .post('/dashboard/research-status')
        .send({ action: 'start' })
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 5000));

      const comparisons = await prismaService.promotionComparison.findMany();
      expect(comparisons.length).toBeGreaterThan(0);

      const comparison = comparisons[0];
      expect(comparison.status).toBe(ComparisonStatus.PENDING);

      const updateResponse = await request(app.getHttpServer())
        .patch(`/promotions/comparisons/${comparison.id}`)
        .send({ action: 'update', notes: 'Updated manually' })
        .expect(200);

      const updateBody = updateResponse.body as UpdateComparisonResponseDto;
      expect(updateBody.success).toBe(true);
      expect(updateBody.comparison.status).toBe(ComparisonStatus.UPDATED);

      const updatedComparison =
        await prismaService.promotionComparison.findUnique({
          where: { id: comparison.id },
        });
      expect(updatedComparison?.status).toBe(ComparisonStatus.UPDATED);
      expect(updatedComparison?.notes).toBe('Updated manually');
    });
  });
});
