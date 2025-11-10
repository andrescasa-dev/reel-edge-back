import { Casino } from '../entities/casino.entity';
import { StateAbbreviation } from '../enums/state.enum';

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

  create(
    casino: Omit<Casino, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Casino>;

  update(id: string, data: Partial<Casino>): Promise<Casino>;

  delete(id: string): Promise<void>;

  existsByNameAndState(
    name: string,
    state: StateAbbreviation,
  ): Promise<boolean>;

  countByState(state: StateAbbreviation): Promise<number>;
}
