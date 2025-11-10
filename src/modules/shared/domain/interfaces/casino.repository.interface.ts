import { Casino } from '../entities/casino.entity';
import { StateAbbreviation } from '../enums/state.enum';

/**
 * Data structure for creating a new casino
 */
export interface CreateCasinoData {
  casinodb_id: number;
  name: string;
  state: StateAbbreviation;
  website?: string;
  regulatoryId?: string;
}

/**
 * Data structure for updating a casino
 */
export interface UpdateCasinoData {
  name?: string;
  state?: StateAbbreviation;
  website?: string;
  regulatoryId?: string;
}

/**
 * Casino Repository Interface
 * Defines contract for casino data persistence
 */
export interface ICasinoRepository {
  findById(id: string): Promise<Casino | null>;

  findByCasinoDbId(casinoDbId: number): Promise<Casino | null>;

  findAll(): Promise<Casino[]>;

  findByState(state: StateAbbreviation): Promise<Casino[]>;

  findByStates(states: StateAbbreviation[]): Promise<Casino[]>;

  searchByName(name: string, state?: StateAbbreviation): Promise<Casino[]>;

  create(casino: CreateCasinoData): Promise<Casino>;

  update(id: string, data: UpdateCasinoData): Promise<Casino>;

  delete(id: string): Promise<void>;

  existsByNameAndState(
    name: string,
    state: StateAbbreviation,
  ): Promise<boolean>;

  countByState(state: StateAbbreviation): Promise<number>;
}
