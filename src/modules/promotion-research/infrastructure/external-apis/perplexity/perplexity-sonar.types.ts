/**
 * Discovered promotion information from Perplexity Sonar
 */
export interface DiscoveredPromotion {
  casinoName: string;
  offerName: string;
  offerType: string;
  expectedDeposit: number;
  expectedBonus: number;
  termsAndConditions?: string;
  wageringRequirements?: string;
  validUntil?: string;
}

/**
 * Raw promotion data from API response before transformation
 */
export interface RawPromotionData {
  casinoName?: string;
  offerName?: string;
  offerType?: string;
  expectedDeposit?: number;
  expectedBonus?: number;
  termsAndConditions?: string;
  wageringRequirements?: string;
  validUntil?: string;
}

/**
 * Batch research result
 */
export interface BatchResearchResult {
  promotions: DiscoveredPromotion[];
  citations: string[];
  casinos: string[];
}

/**
 * Sonar response from Perplexity API
 */
export interface PerplexitySonarResponse {
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
