/**
 * Scheduled Job data structure
 */
export interface ScheduledJob {
  id: string;
  jobName: string;
  schedule: string;
  lastRun?: Date;
  nextRun: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Scheduled Job Repository Interface
 * Defines contract for scheduled job data persistence (PostgreSQL-based)
 */
export interface IScheduledJobRepository {
  findById(id: string): Promise<ScheduledJob | null>;

  findByName(jobName: string): Promise<ScheduledJob | null>;

  findAll(): Promise<ScheduledJob[]>;

  findActive(): Promise<ScheduledJob[]>;

  /**
   * Find due jobs (nextRun <= now and isActive = true)
   */
  findDue(): Promise<ScheduledJob[]>;

  create(
    job: Omit<ScheduledJob, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ScheduledJob>;

  update(id: string, data: Partial<ScheduledJob>): Promise<ScheduledJob>;

  updateLastRun(
    id: string,
    lastRun: Date,
    nextRun: Date,
  ): Promise<ScheduledJob>;

  /**
   * Activate or deactivate a scheduled job
   */
  setActive(id: string, isActive: boolean): Promise<ScheduledJob>;

  delete(id: string): Promise<void>;

  upsert(
    jobName: string,
    data: Omit<ScheduledJob, 'id' | 'jobName' | 'createdAt' | 'updatedAt'>,
  ): Promise<ScheduledJob>;
}
