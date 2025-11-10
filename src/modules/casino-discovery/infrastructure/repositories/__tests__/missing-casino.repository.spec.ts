import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma/prisma.service';
import { MissingCasinoRepository } from '../missing-casino.repository';
import { StateAbbreviation } from '../../../../shared/domain/enums/state.enum';
import { MissingCasinoNotFoundException } from '../../../../shared/domain/exceptions';
import { cleanDatabase } from '../../../../../../test/helpers/database-cleanup.helper';

describe('MissingCasinoRepository', () => {
  let repository: MissingCasinoRepository;
  let prismaService: PrismaService;

  beforeAll(async () => {
    // Safety check: Ensure test database is configured
    if (!process.env.DATABASE_URL_TEST && process.env.NODE_ENV === 'test') {
      throw new Error(
        'DATABASE_URL_TEST must be set for tests to avoid running against development database',
      );
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [MissingCasinoRepository, PrismaService],
    }).compile();

    repository = module.get<MissingCasinoRepository>(MissingCasinoRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    // Reuse the same Prisma instance for efficiency
    await cleanDatabase(prismaService);
  });

  afterAll(async () => {
    await prismaService.$disconnect();
  });

  describe('create', () => {
    it('should create a new missing casino', async () => {
      const missingCasinoData = {
        name: 'Missing Test Casino',
        state: StateAbbreviation.NJ,
        source: 'Gaming Commission Website',
        website: 'https://missingcasino.com',
        regulatoryId: 'REG-999',
        promotionsFound: 0,
      };

      const created = await repository.create(missingCasinoData);

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.name).toBe(missingCasinoData.name);
      expect(created.state).toBe(missingCasinoData.state);
      expect(created.source).toBe(missingCasinoData.source);
    });
  });

  describe('findAll with filters', () => {
    beforeEach(async () => {
      await repository.create({
        name: 'NJ Missing Casino 1',
        state: StateAbbreviation.NJ,
        source: 'Source 1',
        promotionsFound: 0,
      });
      await repository.create({
        name: 'NJ Missing Casino 2',
        state: StateAbbreviation.NJ,
        source: 'Source 2',
        promotionsFound: 0,
      });
      await repository.create({
        name: 'PA Missing Casino',
        state: StateAbbreviation.PA,
        source: 'Source 3',
        promotionsFound: 0,
      });
    });

    it('should find all missing casinos without filters', async () => {
      const all = await repository.findAll();

      expect(all).toHaveLength(3);
    });

    it('should filter by state', async () => {
      const njCasinos = await repository.findAll({
        state: StateAbbreviation.NJ,
      });

      expect(njCasinos).toHaveLength(2);
      expect(njCasinos.every((c) => c.state === StateAbbreviation.NJ)).toBe(
        true,
      );
    });

    it('should filter by search term', async () => {
      const searched = await repository.findAll({
        search: 'Casino 2',
      });

      expect(searched).toHaveLength(1);
      expect(searched[0].name).toBe('NJ Missing Casino 2');
    });

    it('should support pagination with limit and offset', async () => {
      const page1 = await repository.findAll({ limit: 2, offset: 0 });
      const page2 = await repository.findAll({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
    });
  });

  describe('searchByName', () => {
    it('should search missing casinos by name (case insensitive)', async () => {
      await repository.create({
        name: 'Golden Palace',
        state: StateAbbreviation.MI,
        source: 'Source',
        promotionsFound: 0,
      });
      await repository.create({
        name: 'Silver Palace',
        state: StateAbbreviation.MI,
        source: 'Source',
        promotionsFound: 0,
      });

      const results = await repository.searchByName('palace');

      expect(results).toHaveLength(2);
    });
  });

  describe('updatePromotionsFound', () => {
    it('should update the promotions found count', async () => {
      const created = await repository.create({
        name: 'Casino with Promotions',
        state: StateAbbreviation.WV,
        source: 'Source',
        promotionsFound: 0,
      });

      const updated = await repository.updatePromotionsFound(created.id, 5);

      expect(updated.promotionsFound).toBe(5);
    });

    it('should throw MissingCasinoNotFoundException when updating non-existent casino', async () => {
      await expect(
        repository.updatePromotionsFound('non-existent-id', 5),
      ).rejects.toThrow(MissingCasinoNotFoundException);
    });
  });

  describe('count', () => {
    beforeEach(async () => {
      await repository.create({
        name: 'NJ Casino',
        state: StateAbbreviation.NJ,
        source: 'Source',
        promotionsFound: 0,
      });
      await repository.create({
        name: 'PA Casino',
        state: StateAbbreviation.PA,
        source: 'Source',
        promotionsFound: 0,
      });
    });

    it('should count all missing casinos', async () => {
      const count = await repository.count();

      expect(count).toBe(2);
    });

    it('should count by state', async () => {
      const count = await repository.count({ state: StateAbbreviation.NJ });

      expect(count).toBe(1);
    });
  });
});
