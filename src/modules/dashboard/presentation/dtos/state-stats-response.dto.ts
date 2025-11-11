import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';
import { ResearchStatus } from '../../../shared/domain/enums/research-status.enum';

/**
 * State DTO matching API spec
 */
export class StateDto {
  Abbreviation: StateAbbreviation;
  Name: string;
}

/**
 * State Stats Response DTO matching API spec
 */
export class StateStatsResponseDto {
  state: StateDto;
  casinosTracked: number;
  promotionsActive: number;
  lastUpdated: Date;
  status: ResearchStatus;
  missingCasinos?: number;
  pendingComparisons?: number;
}

/**
 * Response wrapper for state stats endpoint
 */
export class StateStatsListResponseDto {
  data: StateStatsResponseDto[];
  timestamp: Date;
}
