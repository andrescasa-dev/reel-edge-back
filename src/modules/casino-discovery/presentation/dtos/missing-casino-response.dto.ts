import {
  StateAbbreviation,
  STATE_NAMES,
} from '../../../shared/domain/enums/state.enum';
import { MissingCasino } from '../../domain/entities/missing-casino.entity';

/**
 * State DTO for missing casino response
 */
export class MissingCasinoStateDto {
  Abbreviation: StateAbbreviation;
  Name: string;
}

/**
 * Missing Casino Response DTO matching API spec
 */
export class MissingCasinoResponseDto {
  id: string;
  name: string;
  state: MissingCasinoStateDto;
  source: string;
  promotionsFound: number;
  discoveredAt: Date;
  website?: string;
  regulatoryId?: string;
}

/**
 * Pagination DTO matching API spec
 */
export class PaginationDto {
  total: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Missing Casinos List Response DTO
 */
export class MissingCasinosListResponseDto {
  data: MissingCasinoResponseDto[];
  pagination: PaginationDto;
}

/**
 * Mapper function to convert MissingCasino entity to DTO
 */
export function mapMissingCasinoToDto(
  missingCasino: MissingCasino,
): MissingCasinoResponseDto {
  return {
    id: missingCasino.id,
    name: missingCasino.name,
    state: {
      Abbreviation: missingCasino.state,
      Name: STATE_NAMES[missingCasino.state],
    },
    source: missingCasino.source,
    promotionsFound: missingCasino.promotionsFound,
    discoveredAt: missingCasino.discoveredAt || new Date(),
    website: missingCasino.website,
    regulatoryId: missingCasino.regulatoryId,
  };
}
