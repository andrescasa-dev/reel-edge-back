import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { StateAbbreviation } from '../../../../shared/domain/enums/state.enum';
import { PerplexityAPIException } from '../../../../shared/domain/exceptions';
import { HttpClient } from '../../../../shared/infrastructure/external-apis/http-client';
import { RateLimiterService } from '../../../../shared/infrastructure/rate-limiting';
import {
  DiscoveredCasino,
  PerplexitySearchResponse,
  RawCasinoData,
} from './perplexity-search.types';

/**
 * Client for Perplexity Search API - used for casino discovery
 * Uses cheaper Search API (not Sonar) for simple information retrieval
 */
@Injectable()
export class PerplexitySearchClient {
  private readonly logger = new Logger(PerplexitySearchClient.name);
  private readonly httpClient: HttpClient;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimiter: RateLimiterService,
  ) {
    this.apiKey = this.configService.get<string>('PERPLEXITY_API_KEY') || '';

    if (!this.apiKey) {
      this.logger.error('PERPLEXITY_API_KEY is not configured');
      throw new Error('Perplexity API key is required');
    }

    this.httpClient = new HttpClient(
      {
        baseURL: 'https://api.perplexity.ai',
        timeout: 60000,
        maxRetries: 3,
        retryDelay: 2000,
      },
      PerplexitySearchClient.name,
    );

    this.logger.log('PerplexitySearchClient initialized');
  }

  /**
   * Search for casinos in a specific state
   * Returns discovered casinos with metadata
   */
  async searchCasinos(state: StateAbbreviation): Promise<{
    casinos: DiscoveredCasino[];
    citations: string[];
  }> {
    this.logger.log(`Searching for casinos in state: ${state}`);

    const prompt = this.buildSearchPrompt(state);

    try {
      const response = await this.rateLimiter.execute(() =>
        this.makeSearchRequest(prompt),
      );

      const casinos = this.parseCasinoResponse(response.content, state);
      const citations = response.citations || [];

      this.logger.log(
        `Found ${casinos.length} casinos in ${state}. Citations: ${citations.length}`,
      );

      return { casinos, citations };
    } catch (error) {
      this.logger.error(`Failed to search casinos for state ${state}`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Build search prompt for casino discovery
   * Prioritizes official sources and regulatory information
   */
  private buildSearchPrompt(state: StateAbbreviation): string {
    const stateNames: Record<StateAbbreviation, string> = {
      NJ: 'New Jersey',
      MI: 'Michigan',
      PA: 'Pennsylvania',
      WV: 'West Virginia',
    };

    const stateName = stateNames[state];

    return `You are a research assistant specialized in gathering accurate information about regulated online casinos.

TASK: Find all legally licensed and operating online casinos in ${stateName} (${state}).

REQUIREMENTS:
1. ONLY include casinos that are:
   - Legally licensed and regulated in ${stateName}
   - Currently accepting players from ${stateName}
   - Operating online (not just land-based)

2. For EACH casino, provide:
   - Official casino name
   - Official website URL (e.g., https://casinoname.com)
   - Regulatory ID or license number (if available from official sources)

3. PRIORITIZE these official sources:
   - State gambling commission websites
   - Official regulatory authority sites
   - Licensed casino operators' official websites
   - Government regulatory databases

4. DO NOT include:
   - Affiliate marketing sites
   - Casino review sites
   - Social casinos (sweepstakes casinos)
   - Unlicensed or offshore casinos

FORMAT your response as a JSON array:
[
  {
    "name": "Casino Name",
    "website": "https://website.com",
    "regulatoryId": "License-123" // Optional, only if found from official source
  }
]

If you cannot find any licensed casinos, return an empty array: []

Focus on accuracy and official sources. It's better to return fewer verified casinos than to include unverified ones.`;
  }

  /**
   * Make API request to Perplexity Search
   */
  private async makeSearchRequest(
    prompt: string,
  ): Promise<{ content: string; citations?: string[] }> {
    this.logger.debug('Sending search request to Perplexity API');
    this.logger.debug(`Prompt: ${prompt.substring(0, 200)}...`);

    try {
      const response = await this.httpClient.post<PerplexitySearchResponse>(
        '/chat/completions',
        {
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content:
                'You are a precise research assistant. Always cite official sources. Return data in valid JSON format.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 2000,
          return_citations: true,
          search_recency_filter: 'month',
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const content = response.data.choices[0]?.message?.content || '';
      const citations = response.data.citations || [];

      this.logger.debug(`Response received. Content length: ${content.length}`);
      this.logger.debug(`Citations: ${citations.length}`);
      this.logger.debug(`Raw response: ${content.substring(0, 500)}...`);

      return { content, citations };
    } catch (error) {
      if (this.httpClient.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 429) {
          const headers = axiosError.response.headers as Record<
            string,
            unknown
          >;
          const retryAfterHeader = headers['retry-after'];
          const retryAfter = parseInt(
            typeof retryAfterHeader === 'string' ? retryAfterHeader : '60',
          );
          await this.rateLimiter.handleRateLimitError(retryAfter);
          throw PerplexityAPIException.rateLimitExceeded(retryAfter);
        }
      }
      throw error;
    }
  }

  /**
   * Parse casino information from AI response
   * Extracts structured data about casinos
   */
  private parseCasinoResponse(
    content: string,
    state: StateAbbreviation,
  ): DiscoveredCasino[] {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('No JSON array found in response');
        return [];
      }

      const jsonString = jsonMatch[0];
      const parsedData: unknown = JSON.parse(jsonString);

      if (!Array.isArray(parsedData)) {
        this.logger.warn('Parsed data is not an array');
        return [];
      }

      const casinos: DiscoveredCasino[] = parsedData
        .filter((item: unknown): item is RawCasinoData => {
          return (
            item !== null &&
            typeof item === 'object' &&
            'name' in item &&
            typeof (item as RawCasinoData).name === 'string'
          );
        })
        .map((item: RawCasinoData) => ({
          name: this.cleanCasinoName(item.name!),
          website: this.cleanWebsite(item.website),
          regulatoryId: item.regulatoryId || undefined,
          state,
        }));

      this.logger.log(`Parsed ${casinos.length} casinos from response`);
      return casinos;
    } catch (error) {
      this.logger.error('Failed to parse casino response', error);
      throw PerplexityAPIException.invalidResponse(
        'Could not parse casino data from response',
      );
    }
  }

  /**
   * Clean and normalize casino name
   */
  private cleanCasinoName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^["']|["']$/g, '');
  }

  /**
   * Clean and validate website URL
   */
  private cleanWebsite(website: string | undefined): string | undefined {
    if (!website) {
      return undefined;
    }

    const cleaned = website.trim().toLowerCase();

    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      return `https://${cleaned}`;
    }

    return cleaned;
  }

  /**
   * Handle and transform errors to PerplexityAPIException
   */
  private handleError(error: unknown): PerplexityAPIException {
    if (error instanceof PerplexityAPIException) {
      return error;
    }

    if (this.httpClient.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.code === 'ECONNABORTED') {
        return PerplexityAPIException.timeout();
      }

      if (!axiosError.response) {
        return PerplexityAPIException.networkError(axiosError);
      }

      const status = axiosError.response.status;
      const message = axiosError.message || 'Unknown error';

      if (status === 401 || status === 403) {
        return PerplexityAPIException.invalidApiKey();
      }

      if (status === 429) {
        return PerplexityAPIException.rateLimitExceeded();
      }

      return PerplexityAPIException.apiError(status, message);
    }

    if (error instanceof Error) {
      return PerplexityAPIException.networkError(error);
    }

    return new PerplexityAPIException('Unknown error occurred');
  }
}
