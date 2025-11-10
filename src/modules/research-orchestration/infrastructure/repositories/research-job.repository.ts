import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma/prisma.service';
import {
  IResearchJobRepository,
  CreateResearchJobData,
  UpdateResearchJobData,
} from '../../domain/interfaces/research-job.repository.interface';
import {
  ResearchJob,
  ResearchJobStatus,
} from '../../domain/entities/research-job.entity';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';
import {
  ResearchJobNotFoundException,
  DatabaseException,
} from '../../../shared/domain/exceptions';
import { Prisma, ResearchJob as PrismaResearchJob } from '@prisma/client';

/**
 * Research Job Repository Implementation
 * Handles persistence for ResearchJob entities with status tracking
 */
@Injectable()
export class ResearchJobRepository implements IResearchJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ResearchJob | null> {
    try {
      const job = await this.prisma.researchJob.findUnique({
        where: { id },
      });

      return job ? this.toDomain(job) : null;
    } catch (error) {
      throw new DatabaseException('findById', error as Error);
    }
  }

  async findAll(filters?: {
    status?: ResearchJobStatus;
    limit?: number;
    offset?: number;
  }): Promise<ResearchJob[]> {
    try {
      const where: Prisma.ResearchJobWhereInput = {};

      if (filters?.status) {
        where.status = filters.status;
      }

      const jobs = await this.prisma.researchJob.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: filters?.limit,
        skip: filters?.offset,
      });

      return jobs.map((job) => this.toDomain(job));
    } catch (error) {
      throw new DatabaseException('findAll', error as Error);
    }
  }

  async findByStatus(status: ResearchJobStatus): Promise<ResearchJob[]> {
    try {
      const jobs = await this.prisma.researchJob.findMany({
        where: { status },
        orderBy: { startedAt: 'desc' },
      });

      return jobs.map((job) => this.toDomain(job));
    } catch (error) {
      throw new DatabaseException('findByStatus', error as Error);
    }
  }

  async findMostRecent(): Promise<ResearchJob | null> {
    try {
      const job = await this.prisma.researchJob.findFirst({
        orderBy: { startedAt: 'desc' },
      });

      return job ? this.toDomain(job) : null;
    } catch (error) {
      throw new DatabaseException('findMostRecent', error as Error);
    }
  }

  async findRunning(): Promise<ResearchJob | null> {
    try {
      const job = await this.prisma.researchJob.findFirst({
        where: { status: ResearchJobStatus.RUNNING },
        orderBy: { startedAt: 'desc' },
      });

      return job ? this.toDomain(job) : null;
    } catch (error) {
      throw new DatabaseException('findRunning', error as Error);
    }
  }

  async create(job: CreateResearchJobData): Promise<ResearchJob> {
    try {
      const created = await this.prisma.researchJob.create({
        data: {
          states: job.states,
          status: job.status,
          completedAt: job.completedAt,
          results: job.results || Prisma.JsonNull,
          errors: job.errors || Prisma.JsonNull,
        },
      });

      return this.toDomain(created);
    } catch (error) {
      throw new DatabaseException('create', error as Error);
    }
  }

  async update(id: string, data: UpdateResearchJobData): Promise<ResearchJob> {
    try {
      const updateData: Prisma.ResearchJobUpdateInput = {};

      if (data.status) {
        updateData.status = data.status;
      }

      if (data.completedAt) {
        updateData.completedAt = data.completedAt;
      }

      if (data.results) {
        updateData.results = data.results;
      }

      if (data.errors) {
        updateData.errors = data.errors;
      }

      const updated = await this.prisma.researchJob.update({
        where: { id },
        data: updateData,
      });

      return this.toDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ResearchJobNotFoundException(id);
      }
      throw new DatabaseException('update', error as Error);
    }
  }

  async complete(id: string, results: object): Promise<ResearchJob> {
    try {
      const updated = await this.prisma.researchJob.update({
        where: { id },
        data: {
          status: ResearchJobStatus.COMPLETED,
          completedAt: new Date(),
          results,
        },
      });

      return this.toDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ResearchJobNotFoundException(id);
      }
      throw new DatabaseException('complete', error as Error);
    }
  }

  async fail(id: string, errors: object): Promise<ResearchJob> {
    try {
      const updated = await this.prisma.researchJob.update({
        where: { id },
        data: {
          status: ResearchJobStatus.FAILED,
          completedAt: new Date(),
          errors,
        },
      });

      return this.toDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ResearchJobNotFoundException(id);
      }
      throw new DatabaseException('fail', error as Error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.researchJob.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ResearchJobNotFoundException(id);
      }
      throw new DatabaseException('delete', error as Error);
    }
  }

  async countByStatus(status: ResearchJobStatus): Promise<number> {
    try {
      return await this.prisma.researchJob.count({
        where: { status },
      });
    } catch (error) {
      throw new DatabaseException('countByStatus', error as Error);
    }
  }

  async hasRunningJob(): Promise<boolean> {
    try {
      const count = await this.prisma.researchJob.count({
        where: { status: ResearchJobStatus.RUNNING },
      });

      return count > 0;
    } catch (error) {
      throw new DatabaseException('hasRunningJob', error as Error);
    }
  }

  private toDomain(prismaModel: PrismaResearchJob): ResearchJob {
    return ResearchJob.create({
      id: prismaModel.id,
      states: Array.isArray(prismaModel.states)
        ? (prismaModel.states as StateAbbreviation[])
        : (JSON.parse(
            (prismaModel.states as string) || '[]',
          ) as StateAbbreviation[]),
      status: prismaModel.status as ResearchJobStatus,
      startedAt: prismaModel.startedAt,
      completedAt: prismaModel.completedAt ?? undefined,
      results:
        typeof prismaModel.results === 'object' && prismaModel.results !== null
          ? prismaModel.results
          : undefined,
      errors:
        typeof prismaModel.errors === 'object' && prismaModel.errors !== null
          ? prismaModel.errors
          : undefined,
    });
  }
}
