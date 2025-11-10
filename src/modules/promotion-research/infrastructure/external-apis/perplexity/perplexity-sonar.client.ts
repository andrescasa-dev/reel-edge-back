import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Perplexity from '@perplexity-ai/perplexity_ai';
import { Casino } from '../../../../shared/domain/entities/casino.entity';
import { PerplexityAPIException } from '../../../../shared/domain/exceptions';
import { RateLimiterService } from '../../../../shared/infrastructure/rate-limiting';
import { Promotion } from '../../../domain/entities/promotion.entity';
import {
  BatchResearchResult,
  DiscoveredPromotion,
  RawPromotionData,
} from './perplexity-sonar.types';

/**
 * Client for Perplexity Sonar API - used for promotion research
 * Uses Chat Completions SDK with structured JSON outputs
 * Following guide: https://docs.perplexity.ai/guides/chat-completions-sdk
 */
@Injectable()
export class PerplexitySonarClient {
  private readonly logger = new Logger(PerplexitySonarClient.name);
  private readonly client: Perplexity;
  private readonly batchSize: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimiter: RateLimiterService,
  ) {
    const apiKey = this.configService.get<string>('PERPLEXITY_API_KEY') || '';
    this.batchSize =
      this.configService.get<number>('PROMOTION_BATCH_SIZE') || 7;

    if (!apiKey) {
      this.logger.error('PERPLEXITY_API_KEY is not configured');
      throw new Error('Perplexity API key is required');
    }

    this.client = new Perplexity({ apiKey });

    this.logger.log(
      `PerplexitySonarClient initialized with batch size: ${this.batchSize}`,
    );
  }

  /**
   * Query promotions for a batch of casinos
   * Includes existing promotions for context
   */
  async queryPromotionsBatch(
    casinos: Casino[],
    existingPromotions: Map<string, Promotion[]>,
  ): Promise<BatchResearchResult> {
    if (casinos.length === 0) {
      this.logger.warn('Empty casino batch provided');
      return { promotions: [], citations: [], casinos: [] };
    }

    const batchSize = Math.min(casinos.length, this.batchSize);
    const casinoBatch = casinos.slice(0, batchSize);

    this.logger.log(
      `Querying promotions for batch of ${casinoBatch.length} casinos`,
    );

    const prompt = this.buildBatchPrompt(casinoBatch, existingPromotions);

    try {
      const response = await this.rateLimiter.execute(() =>
        this.makeSonarRequest(prompt),
      );

      const promotions = this.parsePromotionResponse(response.content);
      const citations = response.citations || [];
      const casinoNames = casinoBatch.map((c) => c.name);

      this.logger.log(
        `Found ${promotions.length} promotions. Citations: ${citations.length}`,
      );

      return { promotions, citations, casinos: casinoNames };
    } catch (error) {
      this.logger.error('Failed to query promotions batch', error);
      throw this.handleError(error);
    }
  }

  /**
   * Build batch prompt for promotion research
   * Includes existing promotions for comparison context
   */
  private buildBatchPrompt(
    casinos: Casino[],
    existingPromotions: Map<string, Promotion[]>,
  ): string {
    const casinoList = casinos
      .map((casino, index) => {
        const existingPromos = existingPromotions.get(casino.name) || [];
        const existingInfo =
          existingPromos.length > 0
            ? `\n     Current known promotions: ${existingPromos
                .map(
                  (p) =>
                    `"${p.offerName}" (${p.offerType}): $${p.expectedBonus} on $${p.expectedDeposit} deposit`,
                )
                .join(', ')}`
            : '\n     Current known promotions: None';

        return `${index + 1}. ${casino.name} (${casino.state})${casino.website ? `\n     Website: ${casino.website}` : ''}${existingInfo}`;
      })
      .join('\n\n');

    return `You are a research assistant specialized in finding accurate, up-to-date information about online casino promotional offers.

TASK: Research current promotional offers for the following online casinos. For each casino, find their ACTIVE welcome bonuses and promotional offers.

CASINOS TO RESEARCH:
${casinoList}

REQUIREMENTS:
1. For EACH casino, find:
   - Welcome bonus offers (new player bonuses)
   - Deposit match offers
   - No deposit bonuses (if available)
   - Free spin offers (if applicable)

2. For EACH promotion found, extract:
   - Casino name (exactly as listed above)
   - Offer name (e.g., "Welcome Bonus", "First Deposit Match")
   - Offer type (e.g., "welcome_bonus", "deposit_match", "no_deposit_bonus", "free_spins")
   - Required deposit amount in USD (use 0 for no deposit bonuses)
   - Bonus amount in USD
   - Wagering requirements (e.g., "30x bonus", "1x deposit + bonus")
   - Terms and conditions (brief summary)
   - Expiration date (if mentioned, format: YYYY-MM-DD)

3. PRIORITIZE:
   - Official casino websites (use provided URLs when available)
   - Current, active offers (check dates)
   - Accurate dollar amounts and requirements
   - Terms from official sources

4. VERIFY accuracy by:
   - Cross-referencing multiple sources when possible
   - Checking the casino's official terms and conditions pages
   - Noting if information seems outdated

5. DO NOT include:
   - Expired or inactive promotions
   - Promotions for different states/jurisdictions
   - Unverified affiliate claims
   - Sweepstakes or social casino offers

FORMAT your response as a JSON array:
[
  {
    "casinoName": "Exact Casino Name",
    "offerName": "Welcome Bonus",
    "offerType": "welcome_bonus",
    "expectedDeposit": 10,
    "expectedBonus": 100,
    "wageringRequirements": "30x bonus",
    "termsAndConditions": "Brief terms summary",
    "validUntil": "2025-12-31" // Optional, only if expiration date is found
  }
]

If no current promotions are found for any casino, return an empty array: []

Focus on accuracy and current information. It's better to return fewer verified promotions than to include outdated or unverified ones.`;
  }

  /**
   * Make API request to Perplexity Sonar using Chat Completions SDK
   * Uses structured outputs to enforce JSON response format
   * Following: https://docs.perplexity.ai/guides/structured-outputs
   */
  private async makeSonarRequest(
    prompt: string,
  ): Promise<{ content: string; citations?: string[] }> {
    this.logger.debug('Sending batch request to Perplexity Sonar API');
    this.logger.debug(`Prompt length: ${prompt.length} characters`);

    // Define JSON schema for promotion response structure
    const promotionSchema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          casinoName: { type: 'string' },
          offerName: { type: 'string' },
          offerType: { type: 'string' },
          expectedDeposit: { type: 'number' },
          expectedBonus: { type: 'number' },
          wageringRequirements: { type: 'string' },
          termsAndConditions: { type: 'string' },
          validUntil: { type: 'string' },
        },
        required: [
          'casinoName',
          'offerName',
          'offerType',
          'expectedDeposit',
          'expectedBonus',
        ],
        additionalProperties: false,
      },
    };

    try {
      const completion = await this.client.chat.completions.create({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content:
              'You are a precise research assistant specializing in casino promotions. Always verify information from official sources. Return data as a JSON array matching the provided schema.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        search_recency_filter: 'week',
        return_images: false,
        return_related_questions: false,
        response_format: {
          type: 'json_schema',
          json_schema: {
            schema: promotionSchema,
          },
        },
      });

      // Extract text content from the response
      const messageContent = completion.choices[0]?.message?.content;
      const content =
        typeof messageContent === 'string'
          ? messageContent
          : JSON.stringify(messageContent);

      // Extract citations from search_results if available
      const citations: string[] = [];
      if (
        'search_results' in completion &&
        Array.isArray(completion.search_results)
      ) {
        for (const result of completion.search_results) {
          if (result && typeof result === 'object' && 'url' in result) {
            citations.push(String(result.url));
          }
        }
      }

      this.logger.debug(`Response received. Content length: ${content.length}`);
      this.logger.debug(`Citations: ${citations.length}`);
      const preview =
        content.length > 500 ? content.substring(0, 500) + '...' : content;
      this.logger.debug(`Raw response: ${preview}`);

      return { content, citations };
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
   * Parse promotion information from AI response
   * Extracts structured data about promotions
   */
  private parsePromotionResponse(content: string): DiscoveredPromotion[] {
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

      const promotions: DiscoveredPromotion[] = parsedData
        .filter((item: unknown): item is RawPromotionData => {
          return (
            item !== null &&
            typeof item === 'object' &&
            'casinoName' in item &&
            'offerName' in item &&
            'offerType' in item &&
            'expectedDeposit' in item &&
            'expectedBonus' in item &&
            typeof (item as RawPromotionData).casinoName === 'string' &&
            typeof (item as RawPromotionData).offerName === 'string' &&
            typeof (item as RawPromotionData).offerType === 'string' &&
            typeof (item as RawPromotionData).expectedDeposit === 'number' &&
            typeof (item as RawPromotionData).expectedBonus === 'number'
          );
        })
        .map((item: RawPromotionData) => ({
          casinoName: this.cleanCasinoName(item.casinoName!),
          offerName: this.cleanString(item.offerName!),
          offerType: this.normalizeOfferType(item.offerType!),
          expectedDeposit: Math.max(0, Number(item.expectedDeposit)),
          expectedBonus: Math.max(0, Number(item.expectedBonus)),
          termsAndConditions: item.termsAndConditions
            ? this.cleanString(item.termsAndConditions)
            : undefined,
          wageringRequirements: item.wageringRequirements
            ? this.cleanString(item.wageringRequirements)
            : undefined,
          validUntil: item.validUntil
            ? this.parseDate(item.validUntil)
            : undefined,
        }));

      this.logger.log(`Parsed ${promotions.length} promotions from response`);
      return promotions;
    } catch (error) {
      this.logger.error('Failed to parse promotion response', error);
      throw PerplexityAPIException.invalidResponse(
        'Could not parse promotion data from response',
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
   * Clean and normalize string
   */
  private cleanString(str: string): string {
    return str
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^["']|["']$/g, '');
  }

  /**
   * Normalize offer type to standard values
   */
  private normalizeOfferType(offerType: string): string {
    const normalized = offerType.toLowerCase().trim().replace(/\s+/g, '_');

    const typeMap: Record<string, string> = {
      welcome_bonus: 'welcome_bonus',
      welcome: 'welcome_bonus',
      deposit_match: 'deposit_match',
      match_bonus: 'deposit_match',
      no_deposit: 'no_deposit_bonus',
      no_deposit_bonus: 'no_deposit_bonus',
      free_spins: 'free_spins',
      free_spin: 'free_spins',
      reload: 'reload_bonus',
      reload_bonus: 'reload_bonus',
    };

    return typeMap[normalized] || normalized;
  }

  /**
   * Parse date string to ISO format
   */
  private parseDate(dateStr: string): string | undefined {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return undefined;
      }
      return date.toISOString();
    } catch {
      return undefined;
    }
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
        'Invalid request: ' + error.message,
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

  /**
   * Get configured batch size
   */
  getBatchSize(): number {
    return this.batchSize;
  }
}
