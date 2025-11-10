import { MissingCasino } from '../entities/missing-casino.entity';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';

/**
 * Data structure for creating a new missing casino
 */
export interface CreateMissingCasinoData {
  name: string;
  state: StateAbbreviation;
  source: string;
  website?: string;
  regulatoryId?: string;
  promotionsFound: number;
}

/**
 * Data structure for updating a missing casino
 */
export interface UpdateMissingCasinoData {
  name?: string;
  state?: StateAbbreviation;
  source?: string;
  website?: string;
  regulatoryId?: string;
  promotionsFound?: number;
}

/**
 * Missing Casino Repository Interface
 * Defines contract for missing casino data persistence
 */
export interface IMissingCasinoRepository {
  findById(id: string): Promise<MissingCasino | null>;

  findAll(filters?: {
    state?: StateAbbreviation;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<MissingCasino[]>;

  findByState(state: StateAbbreviation): Promise<MissingCasino[]>;

  searchByName(
    name: string,
    state?: StateAbbreviation,
  ): Promise<MissingCasino[]>;

  create(missingCasino: CreateMissingCasinoData): Promise<MissingCasino>;

  update(id: string, data: UpdateMissingCasinoData): Promise<MissingCasino>;

  delete(id: string): Promise<void>;

  existsByNameAndState(
    name: string,
    state: StateAbbreviation,
  ): Promise<boolean>;

  countByState(state: StateAbbreviation): Promise<number>;

  count(filters?: {
    state?: StateAbbreviation;
    search?: string;
  }): Promise<number>;

  updatePromotionsFound(id: string, count: number): Promise<MissingCasino>;
}
