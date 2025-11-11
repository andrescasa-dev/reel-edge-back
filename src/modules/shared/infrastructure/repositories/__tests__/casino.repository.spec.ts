import { Test, TestingModule } from '@nestjs/testing';
import { cleanDatabase } from '../../../../../../test/helpers/database-cleanup.helper';
import { StateAbbreviation } from '../../../domain/enums/state.enum';
import { CasinoNotFoundException } from '../../../domain/exceptions';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CasinoRepository } from '../casino.repository';

describe('CasinoRepository', () => {
  let repository: CasinoRepository;
  let prismaService: PrismaService;

  beforeAll(async () => {
    // Safety check: Ensure test database is configured
    if (!process.env.DATABASE_URL_TEST && process.env.NODE_ENV === 'test') {
      throw new Error(
        'DATABASE_URL_TEST must be set for tests to avoid running against development database',
      );
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [CasinoRepository, PrismaService],
    }).compile();

    repository = module.get<CasinoRepository>(CasinoRepository);
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
    it('should create a new casino', async () => {
      const casinoData = {
        casinodb_id: 123,
        name: 'Test Casino',
        state: StateAbbreviation.NJ,
        website: 'https://testcasino.com',
        regulatoryId: 'REG-123',
      };

      const created = await repository.create(casinoData);

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.name).toBe(casinoData.name);
      expect(created.state).toBe(casinoData.state);
      expect(created.casinodb_id).toBe(casinoData.casinodb_id);
      expect(created.website).toBe(casinoData.website);
      expect(created.regulatoryId).toBe(casinoData.regulatoryId);
    });

    it('should fail when creating casino with duplicate casinodb_id', async () => {
      const casinoData = {
        casinodb_id: 456,
        name: 'Test Casino',
        state: StateAbbreviation.NJ,
      };

      await repository.create(casinoData);

      await expect(repository.create(casinoData)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find casino by id', async () => {
      const created = await repository.create({
        casinodb_id: 789,
        name: 'Find By ID Casino',
        state: StateAbbreviation.MI,
      });

      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe(created.name);
    });

    it('should return null when casino not found', async () => {
      const found = await repository.findById('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('findByCasinoDbId', () => {
    it('should find casino by casinodb_id', async () => {
      const casinodbId = 999;
      await repository.create({
        casinodb_id: casinodbId,
        name: 'Find By CasinoDB ID',
        state: StateAbbreviation.PA,
      });

      const found = await repository.findByCasinoDbId(casinodbId);

      expect(found).toBeDefined();
      expect(found?.casinodb_id).toBe(casinodbId);
    });
  });

  describe('findByState', () => {
    it('should find all casinos in a state', async () => {
      await repository.create({
        casinodb_id: 1,
        name: 'NJ Casino 1',
        state: StateAbbreviation.NJ,
      });
      await repository.create({
        casinodb_id: 2,
        name: 'NJ Casino 2',
        state: StateAbbreviation.NJ,
      });
      await repository.create({
        casinodb_id: 3,
        name: 'MI Casino 1',
        state: StateAbbreviation.MI,
      });

      const njCasinos = await repository.findByState(StateAbbreviation.NJ);

      expect(njCasinos).toHaveLength(2);
      expect(njCasinos.every((c) => c.state === StateAbbreviation.NJ)).toBe(
        true,
      );
    });
  });

  describe('searchByName', () => {
    it('should search casinos by name (case insensitive)', async () => {
      await repository.create({
        casinodb_id: 10,
        name: 'Golden Nugget Casino',
        state: StateAbbreviation.NJ,
      });
      await repository.create({
        casinodb_id: 11,
        name: 'Silver Nugget Resort',
        state: StateAbbreviation.NJ,
      });
      await repository.create({
        casinodb_id: 12,
        name: 'Diamond Palace',
        state: StateAbbreviation.NJ,
      });

      const results = await repository.searchByName('nugget');

      expect(results).toHaveLength(2);
      expect(
        results.every((c) => c.name.toLowerCase().includes('nugget')),
      ).toBe(true);
    });
  });

  describe('update', () => {
    it('should update casino data', async () => {
      const created = await repository.create({
        casinodb_id: 20,
        name: 'Original Name',
        state: StateAbbreviation.WV,
      });

      const updated = await repository.update(created.id, {
        name: 'Updated Name',
        website: 'https://updated.com',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.website).toBe('https://updated.com');
      expect(updated.casinodb_id).toBe(created.casinodb_id);
    });

    it('should throw CasinoNotFoundException when updating non-existent casino', async () => {
      await expect(
        repository.update('non-existent-id', { name: 'New Name' }),
      ).rejects.toThrow(CasinoNotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete casino', async () => {
      const created = await repository.create({
        casinodb_id: 30,
        name: 'To Be Deleted',
        state: StateAbbreviation.MI,
      });

      await repository.delete(created.id);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should throw CasinoNotFoundException when deleting non-existent casino', async () => {
      await expect(repository.delete('non-existent-id')).rejects.toThrow(
        CasinoNotFoundException,
      );
    });
  });

  describe('existsByNameAndState', () => {
    it('should return true when casino exists', async () => {
      await repository.create({
        casinodb_id: 40,
        name: 'Existing Casino',
        state: StateAbbreviation.PA,
      });

      const exists = await repository.existsByNameAndState(
        'Existing Casino',
        StateAbbreviation.PA,
      );

      expect(exists).toBe(true);
    });

    it('should return false when casino does not exist', async () => {
      const exists = await repository.existsByNameAndState(
        'Non-Existent Casino',
        StateAbbreviation.PA,
      );

      expect(exists).toBe(false);
    });
  });

  describe('countByState', () => {
    it('should count casinos by state', async () => {
      await repository.create({
        casinodb_id: 50,
        name: 'NJ Casino',
        state: StateAbbreviation.NJ,
      });
      await repository.create({
        casinodb_id: 51,
        name: 'NJ Casino 2',
        state: StateAbbreviation.NJ,
      });

      const count = await repository.countByState(StateAbbreviation.NJ);

      expect(count).toBe(2);
    });
  });
});
