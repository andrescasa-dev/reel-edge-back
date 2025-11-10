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
 */
export interface RawCasinoData {
  name?: string;
  website?: string;
  regulatoryId?: string;
}

/**
 * Search response from Perplexity API
 */
export interface PerplexitySearchResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: string[];
}
