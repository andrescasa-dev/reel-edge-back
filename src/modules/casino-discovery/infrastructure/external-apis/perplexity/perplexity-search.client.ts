import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Perplexity from '@perplexity-ai/perplexity_ai';
import { StateAbbreviation } from '../../../../shared/domain/enums/state.enum';
import { PerplexityAPIException } from '../../../../shared/domain/exceptions';
import { RateLimiterService } from '../../../../shared/infrastructure/rate-limiting';
import { DiscoveredCasino } from './perplexity-search.types';

/**
 * Client for Perplexity Search API - used for casino discovery
 * Uses Search API to get ranked web results for casino information
 */
@Injectable()
export class PerplexitySearchClient {
  private readonly logger = new Logger(PerplexitySearchClient.name);
  private readonly client: Perplexity;

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimiter: RateLimiterService,
  ) {
    const apiKey = this.configService.get<string>('PERPLEXITY_API_KEY') || '';

    if (!apiKey) {
      this.logger.error('PERPLEXITY_API_KEY is not configured');
      throw new Error('Perplexity API key is required');
    }

    this.client = new Perplexity({ apiKey });

    this.logger.log('PerplexitySearchClient initialized');
  }

  /**
   * Search for casinos in a specific state
   * Returns discovered casinos with metadata
   */
  async searchCasinos(state: StateAbbreviation): Promise<{
    casinos: DiscoveredCasino[];
    searchResults: Array<{ title: string; url: string; snippet: string }>;
  }> {
    this.logger.log(`Searching for casinos in state: ${state}`);

    const query = this.buildSearchQuery(state);

    try {
      const response = await this.rateLimiter.execute(() =>
        this.makeSearchRequest(query),
      );

      const casinos = this.parseSearchResults(response.results, state);
      const searchResults = response.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet || '',
      }));

      this.logger.log(
        `Found ${casinos.length} casinos in ${state} from ${searchResults.length} search results`,
      );

      return { casinos, searchResults };
    } catch (error) {
      this.logger.error(`Failed to search casinos for state ${state}`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Build search query for casino discovery
   * Creates targeted search queries for the Search API
   */
  private buildSearchQuery(state: StateAbbreviation): string {
    const stateNames: Record<StateAbbreviation, string> = {
      NJ: 'New Jersey',
      MI: 'Michigan',
      PA: 'Pennsylvania',
      WV: 'West Virginia',
    };

    const stateName = stateNames[state];

    // Search query optimized for finding official casino information
    return `licensed online casinos ${stateName} ${state} gambling commission official website`;
  }

  /**
   * Make API request to Perplexity Search
   */
  private async makeSearchRequest(query: string): Promise<{
    results: Array<{
      title: string;
      url: string;
      snippet?: string;
      date?: string;
      lastUpdated?: string;
    }>;
  }> {
    this.logger.debug('Sending search request to Perplexity Search API');
    this.logger.debug(`Query: ${query}`);

    try {
      const response = await this.client.search.create({
        query,
        max_results: 20, // Maximum results for comprehensive discovery
        max_tokens_per_page: 2048, // Comprehensive content extraction
      });

      const results = response.results.map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.snippet || undefined,
        date: result.date || undefined,
        lastUpdated: result.last_updated || undefined,
      }));

      this.logger.debug(`Response received. Results: ${results.length}`);

      return { results };
    } catch (error) {
      if (error instanceof Perplexity.RateLimitError) {
        const retryAfter = 60; // Default retry after 60 seconds
        await this.rateLimiter.handleRateLimitError(retryAfter);
        throw PerplexityAPIException.rateLimitExceeded(retryAfter);
      }
      throw error;
    }
  }

  /**
   * Parse search results to extract casino information
   * Processes web search results to identify casinos
   */
  private parseSearchResults(
    results: Array<{
      title: string;
      url: string;
      snippet?: string;
    }>,
    state: StateAbbreviation,
  ): DiscoveredCasino[] {
    const casinos: DiscoveredCasino[] = [];
    const seenNames = new Set<string>();

    for (const result of results) {
      // Extract casino name from title or snippet
      const casinoName = this.extractCasinoName(result.title, result.snippet);

      if (!casinoName || seenNames.has(casinoName.toLowerCase())) {
        continue;
      }

      // Check if URL looks like an official casino website
      if (this.isOfficialCasinoUrl(result.url)) {
        seenNames.add(casinoName.toLowerCase());

        casinos.push({
          name: casinoName,
          website: this.cleanWebsite(result.url),
          state,
        });
      }
    }

    this.logger.log(
      `Extracted ${casinos.length} unique casinos from search results`,
    );
    return casinos;
  }

  /**
   * Extract casino name from search result
   */
  private extractCasinoName(title: string, snippet?: string): string | null {
    // Common patterns for casino names in titles
    const patterns = [
      /^([^-|]+) (?:Casino|Online Casino|Gaming)/i,
      /^(.+?) - (?:Official Site|Online Casino)/i,
      /([A-Z][a-zA-Z\s&]+(?:Casino|Bet|Gaming|Sportsbook))/,
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        return this.cleanCasinoName(match[1]);
      }
    }

    // Try extracting from snippet
    if (snippet) {
      const snippetMatch = snippet.match(
        /([A-Z][a-zA-Z\s&]+(?:Casino|Bet|Gaming|Sportsbook))/,
      );
      if (snippetMatch && snippetMatch[1]) {
        return this.cleanCasinoName(snippetMatch[1]);
      }
    }

    return null;
  }

  /**
   * Check if URL appears to be an official casino website
   */
  private isOfficialCasinoUrl(url: string): boolean {
    const urlLower = url.toLowerCase();

    // Exclude review sites, affiliates, and directories
    const excludePatterns = [
      'review',
      'affiliate',
      'bonus',
      'guide',
      'compare',
      'reddit',
      'forum',
      'wikipedia',
      'gambling.com',
      'casino.org',
    ];

    for (const pattern of excludePatterns) {
      if (urlLower.includes(pattern)) {
        return false;
      }
    }

    // Must include casino-related terms in domain
    const includePatterns = ['casino', 'bet', 'gaming', 'sportsbook'];

    return includePatterns.some((pattern) => urlLower.includes(pattern));
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

    if (error instanceof Perplexity.BadRequestError) {
      return PerplexityAPIException.invalidResponse(
        'Invalid search request: ' + error.message,
      );
    }

    if (error instanceof Perplexity.RateLimitError) {
      return PerplexityAPIException.rateLimitExceeded(60);
    }

    if (error instanceof Perplexity.APIError) {
      const status = typeof error.status === 'number' ? error.status : 500;
      return PerplexityAPIException.apiError(status, error.message);
    }

    if (error instanceof Error) {
      return PerplexityAPIException.networkError(error);
    }

    return new PerplexityAPIException('Unknown error occurred');
  }
}
