import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { cleanDatabase } from '../helpers/database-cleanup.helper';
import { PrismaService } from '../../src/modules/shared/infrastructure/database/prisma/prisma.service';
import { HttpExceptionFilter } from '../../src/modules/shared/presentation/filters/http-exception.filter';
import { StateAbbreviation } from '../../src/modules/shared/domain/enums/state.enum';
import { ComparisonType } from '../../src/modules/shared/domain/enums/comparison-type.enum';
import { ComparisonStatus } from '../../src/modules/shared/domain/enums/comparison-status.enum';
import { StateStatsListResponseDto } from '../../src/modules/dashboard/presentation/dtos/state-stats-response.dto';
import { ResearchStatusResponseDto } from '../../src/modules/dashboard/presentation/dtos/start-research.dto';
import {
  MissingCasinoResponseDto,
  MissingCasinosListResponseDto,
} from '../../src/modules/casino-discovery/presentation/dtos/missing-casino-response.dto';
import {
  PromotionComparisonResponseDto,
  PromotionComparisonsListResponseDto,
  UpdateComparisonResponseDto,
} from '../../src/modules/promotion-research/presentation/dtos/promotion-comparison-response.dto';

interface ErrorResponse {
  error: string;
  message: string;
}

describe('API Contracts (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

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
  });

  beforeEach(async () => {
    await cleanDatabase(prismaService);

    const casino = await prismaService.casino.create({
      data: {
        id: 'casino-1',
        casinodb_id: 1,
        name: 'Test Casino NJ',
        state: StateAbbreviation.NJ,
        website: 'https://testcasino.com',
        regulatoryId: 'NJ-001',
      },
    });

    await prismaService.missingCasino.create({
      data: {
        id: 'missing-1',
        name: 'Missing Casino',
        state: StateAbbreviation.MI,
        source: 'Gaming Commission',
        website: 'https://missing.com',
        regulatoryId: 'MI-002',
        promotionsFound: 0,
      },
    });

    await prismaService.promotionComparison.create({
      data: {
        id: 'comparison-1',
        casinoId: casino.id,
        currentOfferName: 'Current Bonus',
        currentOfferType: 'Deposit Bonus',
        currentExpectedDeposit: 100,
        currentExpectedBonus: 50,
        discoveredOfferName: 'Better Bonus',
        discoveredOfferType: 'Deposit Bonus',
        discoveredExpectedDeposit: 100,
        discoveredExpectedBonus: 75,
        comparisonType: ComparisonType.BETTER,
        status: ComparisonStatus.PENDING,
        sources: ['https://test.com'],
      },
    });
  });

  afterAll(async () => {
    await prismaService.$disconnect();
    await app.close();
  });

  describe('GET /dashboard/state-stats', () => {
    it('should return state stats with correct structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/state-stats')
        .expect(200);

      const body = response.body as StateStatsListResponseDto;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('timestamp');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const stat = body.data[0];
        expect(stat).toHaveProperty('state');
        expect(stat.state).toHaveProperty('Abbreviation');
        expect(stat.state).toHaveProperty('Name');
        expect(stat).toHaveProperty('casinosTracked');
        expect(stat).toHaveProperty('promotionsActive');
        expect(stat).toHaveProperty('lastUpdated');
        expect(stat).toHaveProperty('status');
        expect(['researching', 'idle']).toContain(stat.status);
      }
    });
  });

  describe('POST /dashboard/research-status', () => {
    it('should start research with action=start', async () => {
      const response = await request(app.getHttpServer())
        .post('/dashboard/research-status')
        .send({ action: 'start' })
        .expect(200);

      const body = response.body as ResearchStatusResponseDto;
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('status');
      expect(['researching', 'idle']).toContain(body.status);
    });

    it('should stop research with action=stop', async () => {
      const response = await request(app.getHttpServer())
        .post('/dashboard/research-status')
        .send({ action: 'stop' })
        .expect(200);

      const body = response.body as ResearchStatusResponseDto;
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('status');
    });

    it('should return 400 for invalid action', async () => {
      const response = await request(app.getHttpServer())
        .post('/dashboard/research-status')
        .send({ action: 'invalid' })
        .expect(400);

      const body = response.body as ErrorResponse;
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });

    it('should return 400 for missing action', async () => {
      const response = await request(app.getHttpServer())
        .post('/dashboard/research-status')
        .send({})
        .expect(400);

      const body = response.body as ErrorResponse;
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });
  });

  describe('GET /missing-casinos', () => {
    it('should return missing casinos with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/missing-casinos')
        .expect(200);

      const body = response.body as MissingCasinosListResponseDto;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const casino = body.data[0];
        expect(casino).toHaveProperty('id');
        expect(casino).toHaveProperty('name');
        expect(casino).toHaveProperty('state');
        expect(casino).toHaveProperty('source');
        expect(casino).toHaveProperty('promotionsFound');
        expect(casino).toHaveProperty('discoveredAt');
      }

      const pagination = body.pagination;
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('limit');
      expect(pagination).toHaveProperty('page');
      expect(pagination).toHaveProperty('totalPages');
      expect(pagination).toHaveProperty('hasNext');
      expect(pagination).toHaveProperty('hasPrevious');
    });

    it('should filter by state', async () => {
      const response = await request(app.getHttpServer())
        .get('/missing-casinos?state=MI')
        .expect(200);

      const body = response.body as MissingCasinosListResponseDto;
      expect(body.data.length).toBeGreaterThan(0);
      body.data.forEach((casino: MissingCasinoResponseDto) => {
        expect(casino.state.Abbreviation).toBe('MI');
      });
    });

    it('should filter by search query', async () => {
      const response = await request(app.getHttpServer())
        .get('/missing-casinos?search=Missing')
        .expect(200);

      const body = response.body as MissingCasinosListResponseDto;
      expect(body.data.length).toBeGreaterThan(0);
      expect(
        body.data.some((c: MissingCasinoResponseDto) =>
          c.name.toLowerCase().includes('missing'),
        ),
      ).toBe(true);
    });

    it('should support pagination with limit and offset', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/missing-casinos?limit=1&offset=0')
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/missing-casinos?limit=1&offset=1')
        .expect(200);

      const body1 = response1.body as MissingCasinosListResponseDto;
      const body2 = response2.body as MissingCasinosListResponseDto;
      expect(body1.data.length).toBeLessThanOrEqual(1);
      expect(body2.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /promotions/comparisons', () => {
    it('should return promotion comparisons with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/promotions/comparisons')
        .expect(200);

      const body = response.body as PromotionComparisonsListResponseDto;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const comparison = body.data[0];
        expect(comparison).toHaveProperty('id');
        expect(comparison).toHaveProperty('casino');
        expect(comparison).toHaveProperty('discoveredPromotion');
        expect(comparison).toHaveProperty('comparisonType');
        expect(comparison).toHaveProperty('status');
        expect(comparison).toHaveProperty('createdAt');
        expect(comparison).toHaveProperty('updatedAt');

        expect(['better', 'alternative', 'new']).toContain(
          comparison.comparisonType,
        );
        expect(['pending', 'updated', 'reviewed', 'ignored']).toContain(
          comparison.status,
        );
      }

      const pagination = body.pagination;
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('limit');
      expect(pagination).toHaveProperty('page');
      expect(pagination).toHaveProperty('totalPages');
      expect(pagination).toHaveProperty('hasNext');
      expect(pagination).toHaveProperty('hasPrevious');
    });

    it('should filter by state', async () => {
      const response = await request(app.getHttpServer())
        .get('/promotions/comparisons?state=NJ')
        .expect(200);

      const body = response.body as PromotionComparisonsListResponseDto;
      if (body.data.length > 0) {
        body.data.forEach((comparison: PromotionComparisonResponseDto) => {
          expect(comparison.casino.state.Abbreviation).toBe('NJ');
        });
      }
    });

    it('should filter by insight (comparisonType)', async () => {
      const response = await request(app.getHttpServer())
        .get('/promotions/comparisons?insight=better')
        .expect(200);

      const body = response.body as PromotionComparisonsListResponseDto;
      if (body.data.length > 0) {
        body.data.forEach((comparison: PromotionComparisonResponseDto) => {
          expect(comparison.comparisonType).toBe('better');
        });
      }
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/promotions/comparisons?status=pending')
        .expect(200);

      const body = response.body as PromotionComparisonsListResponseDto;
      if (body.data.length > 0) {
        body.data.forEach((comparison: PromotionComparisonResponseDto) => {
          expect(comparison.status).toBe('pending');
        });
      }
    });

    it('should filter by offer_type', async () => {
      const response = await request(app.getHttpServer())
        .get('/promotions/comparisons?offer_type=Deposit Bonus')
        .expect(200);

      const body = response.body as PromotionComparisonsListResponseDto;
      if (body.data.length > 0) {
        body.data.forEach((comparison: PromotionComparisonResponseDto) => {
          expect(comparison.discoveredPromotion.offer_type).toBe(
            'Deposit Bonus',
          );
        });
      }
    });

    it('should support pagination with page and limit', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/promotions/comparisons?page=1&limit=1')
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/promotions/comparisons?page=2&limit=1')
        .expect(200);

      const body1 = response1.body as PromotionComparisonsListResponseDto;
      const body2 = response2.body as PromotionComparisonsListResponseDto;
      expect(body1.data.length).toBeLessThanOrEqual(1);
      expect(body2.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('PATCH /promotions/comparisons/:comparisonId', () => {
    it('should update comparison status to updated', async () => {
      const comparisons = await prismaService.promotionComparison.findMany();
      expect(comparisons.length).toBeGreaterThan(0);

      const comparison = comparisons[0];

      const response = await request(app.getHttpServer())
        .patch(`/promotions/comparisons/${comparison.id}`)
        .send({ action: 'update', notes: 'Test notes' })
        .expect(200);

      const body = response.body as UpdateComparisonResponseDto;
      expect(body).toHaveProperty('success');
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('comparison');
      expect(body.comparison.status).toBe('updated');
    });

    it('should update comparison status to ignored', async () => {
      const comparisons = await prismaService.promotionComparison.findMany();
      const comparison = comparisons[0];

      const response = await request(app.getHttpServer())
        .patch(`/promotions/comparisons/${comparison.id}`)
        .send({ action: 'ignore' })
        .expect(200);

      const body = response.body as UpdateComparisonResponseDto;
      expect(body.success).toBe(true);
      expect(body.comparison.status).toBe('ignored');
    });

    it('should return 404 for non-existent comparison', async () => {
      const response = await request(app.getHttpServer())
        .patch('/promotions/comparisons/non-existent-id')
        .send({ action: 'update' })
        .expect(404);

      const body = response.body as ErrorResponse;
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });

    it('should return 400 for invalid action', async () => {
      const comparisons = await prismaService.promotionComparison.findMany();
      const comparison = comparisons[0];

      const response = await request(app.getHttpServer())
        .patch(`/promotions/comparisons/${comparison.id}`)
        .send({ action: 'invalid' })
        .expect(400);

      const body = response.body as ErrorResponse;
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });

    it('should return 400 for missing action', async () => {
      const comparisons = await prismaService.promotionComparison.findMany();
      const comparison = comparisons[0];

      const response = await request(app.getHttpServer())
        .patch(`/promotions/comparisons/${comparison.id}`)
        .send({})
        .expect(400);

      const body = response.body as ErrorResponse;
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });
  });

  describe('Error Handling', () => {
    it('should return error in correct format for 400 errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/dashboard/research-status')
        .send({ action: 'invalid' })
        .expect(400);

      const body = response.body as ErrorResponse;
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
      expect(typeof body.error).toBe('string');
      expect(typeof body.message).toBe('string');
    });

    it('should return error in correct format for 404 errors', async () => {
      const response = await request(app.getHttpServer())
        .patch('/promotions/comparisons/non-existent')
        .send({ action: 'update' })
        .expect(404);

      const body = response.body as ErrorResponse;
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });
  });
});
