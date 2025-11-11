import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduledJobRepository } from '../../infrastructure/repositories/scheduled-job.repository';
import { ResearchOrchestrationService } from '../../application/services/research-orchestration.service';
import { ScheduledJob } from '../../domain/interfaces/scheduled-job.repository.interface';
import parser from 'cron-parser';

/**
 * PostgreSQL-based Job Scheduler
 * Uses NestJS @Cron decorator to check for due jobs every 5 minutes
 * Executes jobs that are due (nextRun <= now and isActive = true)
 */
@Injectable()
export class PgJobScheduler {
  private readonly logger = new Logger(PgJobScheduler.name);

  constructor(
    private readonly scheduledJobRepository: ScheduledJobRepository,
    private readonly researchOrchestrationService: ResearchOrchestrationService,
  ) {}

  /**
   * Check for due jobs every 5 minutes
   * Executes jobs that are due and updates their next run time
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkScheduledJobs(): Promise<void> {
    this.logger.debug('Checking for due scheduled jobs');

    try {
      const dueJobs = await this.scheduledJobRepository.findDue();

      if (dueJobs.length === 0) {
        this.logger.debug('No due jobs found');
        return;
      }

      this.logger.log(`Found ${dueJobs.length} due job(s)`);

      for (const job of dueJobs) {
        await this.executeJob(job);
      }
    } catch (error) {
      this.logger.error('Error checking scheduled jobs', error);
    }
  }

  /**
   * Execute a scheduled job
   * Updates lastRun and calculates nextRun based on cron schedule
   */
  private async executeJob(job: ScheduledJob): Promise<void> {
    this.logger.log(`Executing scheduled job: ${job.jobName}`);

    try {
      if (job.jobName === 'full-research') {
        await this.researchOrchestrationService.startFullResearch();
      } else {
        this.logger.warn(`Unknown job name: ${job.jobName}`);
      }

      const nextRun = this.calculateNextRun(job.schedule);
      await this.scheduledJobRepository.updateLastRun(
        job.id,
        new Date(),
        nextRun,
      );

      this.logger.log(
        `Job ${job.jobName} executed successfully. Next run: ${nextRun.toISOString()}`,
      );
    } catch (error) {
      this.logger.error(`Error executing job ${job.jobName}`, error);
      const nextRun = this.calculateNextRun(job.schedule);
      await this.scheduledJobRepository.updateLastRun(
        job.id,
        new Date(),
        nextRun,
      );
    }
  }

  /**
   * Calculate next run time based on cron expression
   */
  private calculateNextRun(cronExpression: string): Date {
    try {
      const interval = parser.parse(cronExpression);
      const nextDate = interval.next();
      return nextDate.toDate();
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Invalid cron expression: ${cronExpression}`, error);
      const nextDate = new Date();
      nextDate.setHours(nextDate.getHours() + 24);
      return nextDate;
    }
  }
}
