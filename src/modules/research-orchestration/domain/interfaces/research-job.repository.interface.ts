import {
  ResearchJob,
  ResearchJobStatus,
} from '../entities/research-job.entity';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';

/**
 * Data structure for creating a new research job
 */
export interface CreateResearchJobData {
  states: StateAbbreviation[];
  status: ResearchJobStatus;
  completedAt?: Date;
  results?: object;
  errors?: object;
}

/**
 * Data structure for updating a research job
 */
export interface UpdateResearchJobData {
  status?: ResearchJobStatus;
  completedAt?: Date;
  results?: object;
  errors?: object;
}

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

  create(job: CreateResearchJobData): Promise<ResearchJob>;

  update(id: string, data: UpdateResearchJobData): Promise<ResearchJob>;

  complete(id: string, results: object): Promise<ResearchJob>;

  fail(id: string, errors: object): Promise<ResearchJob>;

  delete(id: string): Promise<void>;

  countByStatus(status: ResearchJobStatus): Promise<number>;

  hasRunningJob(): Promise<boolean>;
}
