import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma/prisma.service';
import { ResearchJobRepository } from '../research-job.repository';
import { ResearchJobStatus } from '../../../domain/entities/research-job.entity';
import { StateAbbreviation } from '../../../../shared/domain/enums/state.enum';
import { ResearchJobNotFoundException } from '../../../../shared/domain/exceptions';
import { cleanDatabase } from '../../../../../../test/helpers/database-cleanup.helper';

describe('ResearchJobRepository', () => {
  let repository: ResearchJobRepository;
  let prismaService: PrismaService;

  beforeAll(async () => {
    // Safety check: Ensure test database is configured
    if (!process.env.DATABASE_URL_TEST && process.env.NODE_ENV === 'test') {
      throw new Error(
        'DATABASE_URL_TEST must be set for tests to avoid running against development database',
      );
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [ResearchJobRepository, PrismaService],
    }).compile();

    repository = module.get<ResearchJobRepository>(ResearchJobRepository);
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
    it('should create a new research job', async () => {
      const jobData = {
        states: [StateAbbreviation.NJ, StateAbbreviation.MI],
        status: ResearchJobStatus.RUNNING,
      };

      const created = await repository.create(jobData);

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.states).toEqual(jobData.states);
      expect(created.status).toBe(ResearchJobStatus.RUNNING);
      expect(created.startedAt).toBeDefined();
    });
  });

  describe('findById', () => {
    it('should find research job by id', async () => {
      const created = await repository.create({
        states: [StateAbbreviation.PA],
        status: ResearchJobStatus.RUNNING,
      });

      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null when job not found', async () => {
      const found = await repository.findById('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('findByStatus', () => {
    beforeEach(async () => {
      await repository.create({
        states: [StateAbbreviation.NJ],
        status: ResearchJobStatus.RUNNING,
      });
      await repository.create({
        states: [StateAbbreviation.MI],
        status: ResearchJobStatus.COMPLETED,
      });
      await repository.create({
        states: [StateAbbreviation.PA],
        status: ResearchJobStatus.COMPLETED,
      });
    });

    it('should find jobs by status', async () => {
      const completed = await repository.findByStatus(
        ResearchJobStatus.COMPLETED,
      );

      expect(completed).toHaveLength(2);
      expect(
        completed.every((j) => j.status === ResearchJobStatus.COMPLETED),
      ).toBe(true);
    });
  });

  describe('findRunning', () => {
    it('should find the most recent running job', async () => {
      await repository.create({
        states: [StateAbbreviation.NJ],
        status: ResearchJobStatus.COMPLETED,
      });

      const runningJob = await repository.create({
        states: [StateAbbreviation.MI],
        status: ResearchJobStatus.RUNNING,
      });

      const found = await repository.findRunning();

      expect(found).toBeDefined();
      expect(found?.id).toBe(runningJob.id);
      expect(found?.status).toBe(ResearchJobStatus.RUNNING);
    });

    it('should return null when no running job exists', async () => {
      await repository.create({
        states: [StateAbbreviation.NJ],
        status: ResearchJobStatus.COMPLETED,
      });

      const found = await repository.findRunning();

      expect(found).toBeNull();
    });
  });

  describe('complete', () => {
    it('should mark job as completed with results', async () => {
      const job = await repository.create({
        states: [StateAbbreviation.NJ],
        status: ResearchJobStatus.RUNNING,
      });

      const results = {
        casinosDiscovered: 5,
        promotionsFound: 10,
      };

      const completed = await repository.complete(job.id, results);

      expect(completed.status).toBe(ResearchJobStatus.COMPLETED);
      expect(completed.completedAt).toBeDefined();
      expect(completed.results).toEqual(results);
    });

    it('should throw ResearchJobNotFoundException when completing non-existent job', async () => {
      await expect(repository.complete('non-existent-id', {})).rejects.toThrow(
        ResearchJobNotFoundException,
      );
    });
  });

  describe('fail', () => {
    it('should mark job as failed with errors', async () => {
      const job = await repository.create({
        states: [StateAbbreviation.NJ],
        status: ResearchJobStatus.RUNNING,
      });

      const errors = {
        message: 'API connection failed',
        code: 'CONNECTION_ERROR',
      };

      const failed = await repository.fail(job.id, errors);

      expect(failed.status).toBe(ResearchJobStatus.FAILED);
      expect(failed.completedAt).toBeDefined();
      expect(failed.errors).toEqual(errors);
    });
  });

  describe('hasRunningJob', () => {
    it('should return true when a running job exists', async () => {
      await repository.create({
        states: [StateAbbreviation.NJ],
        status: ResearchJobStatus.RUNNING,
      });

      const hasRunning = await repository.hasRunningJob();

      expect(hasRunning).toBe(true);
    });

    it('should return false when no running job exists', async () => {
      await repository.create({
        states: [StateAbbreviation.NJ],
        status: ResearchJobStatus.COMPLETED,
      });

      const hasRunning = await repository.hasRunningJob();

      expect(hasRunning).toBe(false);
    });
  });

  describe('countByStatus', () => {
    beforeEach(async () => {
      await repository.create({
        states: [StateAbbreviation.NJ],
        status: ResearchJobStatus.COMPLETED,
      });
      await repository.create({
        states: [StateAbbreviation.MI],
        status: ResearchJobStatus.COMPLETED,
      });
      await repository.create({
        states: [StateAbbreviation.PA],
        status: ResearchJobStatus.FAILED,
      });
    });

    it('should count jobs by status', async () => {
      const completedCount = await repository.countByStatus(
        ResearchJobStatus.COMPLETED,
      );
      const failedCount = await repository.countByStatus(
        ResearchJobStatus.FAILED,
      );

      expect(completedCount).toBe(2);
      expect(failedCount).toBe(1);
    });
  });
});
