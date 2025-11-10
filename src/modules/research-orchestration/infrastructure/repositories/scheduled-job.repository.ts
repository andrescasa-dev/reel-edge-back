import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma/prisma.service';
import {
  IScheduledJobRepository,
  ScheduledJob,
} from '../../domain/interfaces/scheduled-job.repository.interface';
import { DatabaseException } from '../../../shared/domain/exceptions';
import { Prisma, ScheduledJob as PrismaScheduledJob } from '@prisma/client';

/**
 * Scheduled Job Repository Implementation
 * Handles persistence for ScheduledJob entities (PostgreSQL-based job scheduler)
 */
@Injectable()
export class ScheduledJobRepository implements IScheduledJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ScheduledJob | null> {
    try {
      const job = await this.prisma.scheduledJob.findUnique({
        where: { id },
      });

      return job ? this.toDomain(job) : null;
    } catch (error) {
      throw new DatabaseException('findById', error as Error);
    }
  }

  async findByName(jobName: string): Promise<ScheduledJob | null> {
    try {
      const job = await this.prisma.scheduledJob.findUnique({
        where: { jobName },
      });

      return job ? this.toDomain(job) : null;
    } catch (error) {
      throw new DatabaseException('findByName', error as Error);
    }
  }

  async findAll(): Promise<ScheduledJob[]> {
    try {
      const jobs = await this.prisma.scheduledJob.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return jobs.map((job) => this.toDomain(job));
    } catch (error) {
      throw new DatabaseException('findAll', error as Error);
    }
  }

  async findActive(): Promise<ScheduledJob[]> {
    try {
      const jobs = await this.prisma.scheduledJob.findMany({
        where: { isActive: true },
        orderBy: { nextRun: 'asc' },
      });

      return jobs.map((job) => this.toDomain(job));
    } catch (error) {
      throw new DatabaseException('findActive', error as Error);
    }
  }

  async findDue(): Promise<ScheduledJob[]> {
    try {
      const now = new Date();
      const jobs = await this.prisma.scheduledJob.findMany({
        where: {
          isActive: true,
          nextRun: {
            lte: now,
          },
        },
        orderBy: { nextRun: 'asc' },
      });

      return jobs.map((job) => this.toDomain(job));
    } catch (error) {
      throw new DatabaseException('findDue', error as Error);
    }
  }

  async create(
    job: Omit<ScheduledJob, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ScheduledJob> {
    try {
      const created = await this.prisma.scheduledJob.create({
        data: {
          jobName: job.jobName,
          schedule: job.schedule,
          lastRun: job.lastRun,
          nextRun: job.nextRun,
          isActive: job.isActive,
        },
      });

      return this.toDomain(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DatabaseException(
          'create',
          new Error(`Scheduled job with name '${job.jobName}' already exists`),
        );
      }
      throw new DatabaseException('create', error as Error);
    }
  }

  async update(id: string, data: Partial<ScheduledJob>): Promise<ScheduledJob> {
    try {
      const updateData: Prisma.ScheduledJobUpdateInput = {};

      if (data.schedule !== undefined) {
        updateData.schedule = data.schedule;
      }

      if (data.lastRun !== undefined) {
        updateData.lastRun = data.lastRun;
      }

      if (data.nextRun !== undefined) {
        updateData.nextRun = data.nextRun;
      }

      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      const updated = await this.prisma.scheduledJob.update({
        where: { id },
        data: updateData,
      });

      return this.toDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new DatabaseException(
          'update',
          new Error(`Job not found: ${id}`),
        );
      }
      throw new DatabaseException('update', error as Error);
    }
  }

  async updateLastRun(
    id: string,
    lastRun: Date,
    nextRun: Date,
  ): Promise<ScheduledJob> {
    try {
      const updated = await this.prisma.scheduledJob.update({
        where: { id },
        data: {
          lastRun,
          nextRun,
        },
      });

      return this.toDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new DatabaseException(
          'updateLastRun',
          new Error(`Job not found: ${id}`),
        );
      }
      throw new DatabaseException('updateLastRun', error as Error);
    }
  }

  async setActive(id: string, isActive: boolean): Promise<ScheduledJob> {
    try {
      const updated = await this.prisma.scheduledJob.update({
        where: { id },
        data: { isActive },
      });

      return this.toDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new DatabaseException(
          'setActive',
          new Error(`Job not found: ${id}`),
        );
      }
      throw new DatabaseException('setActive', error as Error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.scheduledJob.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new DatabaseException(
          'delete',
          new Error(`Job not found: ${id}`),
        );
      }
      throw new DatabaseException('delete', error as Error);
    }
  }

  async upsert(
    jobName: string,
    data: Omit<ScheduledJob, 'id' | 'jobName' | 'createdAt' | 'updatedAt'>,
  ): Promise<ScheduledJob> {
    try {
      const upserted = await this.prisma.scheduledJob.upsert({
        where: { jobName },
        update: {
          schedule: data.schedule,
          lastRun: data.lastRun,
          nextRun: data.nextRun,
          isActive: data.isActive,
        },
        create: {
          jobName,
          schedule: data.schedule,
          lastRun: data.lastRun,
          nextRun: data.nextRun,
          isActive: data.isActive,
        },
      });

      return this.toDomain(upserted);
    } catch (error) {
      throw new DatabaseException('upsert', error as Error);
    }
  }

  private toDomain(prismaModel: PrismaScheduledJob): ScheduledJob {
    return {
      id: prismaModel.id,
      jobName: prismaModel.jobName,
      schedule: prismaModel.schedule,
      lastRun: prismaModel.lastRun ?? undefined,
      nextRun: prismaModel.nextRun,
      isActive: prismaModel.isActive,
      createdAt: prismaModel.createdAt,
      updatedAt: prismaModel.updatedAt,
    };
  }
}
