import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';

/**
 * Research job status
 */
export enum ResearchJobStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Research Job domain entity
 * Represents a research execution for casino discovery and promotion research
 */
export class ResearchJob {
  constructor(
    public readonly id: string,
    public readonly states: StateAbbreviation[],
    public readonly status: ResearchJobStatus,
    public readonly startedAt: Date,
    public readonly completedAt?: Date,
    public readonly results?: object,
    public readonly errors?: object,
  ) {}

  /**
   * Create a ResearchJob entity from data object
   */
  static create(data: {
    id?: string;
    states: StateAbbreviation[];
    status?: ResearchJobStatus;
    startedAt?: Date;
    completedAt?: Date;
    results?: object;
    errors?: object;
  }): ResearchJob {
    return new ResearchJob(
      data.id || '',
      data.states,
      data.status || ResearchJobStatus.RUNNING,
      data.startedAt || new Date(),
      data.completedAt,
      data.results,
      data.errors,
    );
  }

  /**
   * Check if job is running
   */
  isRunning(): boolean {
    return this.status === ResearchJobStatus.RUNNING;
  }

  /**
   * Check if job is completed
   */
  isCompleted(): boolean {
    return this.status === ResearchJobStatus.COMPLETED;
  }

  /**
   * Check if job has failed
   */
  hasFailed(): boolean {
    return this.status === ResearchJobStatus.FAILED;
  }

  /**
   * Get job duration in milliseconds
   */
  getDuration(): number | null {
    if (!this.completedAt) {
      return null;
    }
    return this.completedAt.getTime() - this.startedAt.getTime();
  }

  /**
   * Complete the job
   */
  complete(results: object): ResearchJob {
    return new ResearchJob(
      this.id,
      this.states,
      ResearchJobStatus.COMPLETED,
      this.startedAt,
      new Date(),
      results,
      this.errors,
    );
  }

  /**
   * Mark the job as failed
   */
  fail(errors: object): ResearchJob {
    return new ResearchJob(
      this.id,
      this.states,
      ResearchJobStatus.FAILED,
      this.startedAt,
      new Date(),
      this.results,
      errors,
    );
  }

  /**
   * Convert to plain object
   */
  toObject(): {
    id: string;
    states: StateAbbreviation[];
    status: ResearchJobStatus;
    startedAt: Date;
    completedAt?: Date;
    results?: object;
    errors?: object;
  } {
    return {
      id: this.id,
      states: this.states,
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      results: this.results,
      errors: this.errors,
    };
  }
}
