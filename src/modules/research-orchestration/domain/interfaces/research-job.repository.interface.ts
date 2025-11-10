import {
  ResearchJob,
  ResearchJobStatus,
} from '../entities/research-job.entity';

/**
 * Research Job Repository Interface
 * Defines contract for research job data persistence
 */
export interface IResearchJobRepository {
  findById(id: string): Promise<ResearchJob | null>;

  findAll(filters?: {
    status?: ResearchJobStatus;
    limit?: number;
    offset?: number;
  }): Promise<ResearchJob[]>;

  findByStatus(status: ResearchJobStatus): Promise<ResearchJob[]>;

  findMostRecent(): Promise<ResearchJob | null>;

  findRunning(): Promise<ResearchJob | null>;

  create(job: Omit<ResearchJob, 'id' | 'startedAt'>): Promise<ResearchJob>;

  update(id: string, data: Partial<ResearchJob>): Promise<ResearchJob>;

  complete(id: string, results: object): Promise<ResearchJob>;

  fail(id: string, errors: object): Promise<ResearchJob>;

  delete(id: string): Promise<void>;

  countByStatus(status: ResearchJobStatus): Promise<number>;

  hasRunningJob(): Promise<boolean>;
}
