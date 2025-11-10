import { StateAbbreviation } from '../../../../shared/domain/enums/state.enum';

/**
 * Discovered casino information from Perplexity Search
 */
export interface DiscoveredCasino {
  name: string;
  website?: string;
  regulatoryId?: string;
  state: StateAbbreviation;
}

/**
 * Raw casino data from API response before transformation
 * Not used with Search API but kept for compatibility
 */
export interface RawCasinoData {
  name?: string;
  website?: string;
  regulatoryId?: string;
}
