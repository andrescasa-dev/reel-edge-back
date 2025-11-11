import { Injectable, Logger } from '@nestjs/common';
import { Casino } from '../../../shared/domain/entities/casino.entity';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';
import { CasinoRepository } from '../../../shared/infrastructure/repositories/casino.repository';
import { ReelEdgeData } from '../../../shared/infrastructure/external-apis/reel-edge/reel-edge.client';
import { PerplexitySearchClient } from '../../infrastructure/external-apis/perplexity/perplexity-search.client';
import { DiscoveredCasino } from '../../infrastructure/external-apis/perplexity/perplexity-search.types';
import { MissingCasinoRepository } from '../../infrastructure/repositories/missing-casino.repository';
import { MissingCasino } from '../../domain/entities/missing-casino.entity';

/**
 * Casino Discovery Service
 * Orchestrates casino discovery using Perplexity Search API
 * Compares discovered casinos against Reel Edge DB to identify missing casinos
 */
@Injectable()
export class CasinoDiscoveryService {
  private readonly logger = new Logger(CasinoDiscoveryService.name);

  constructor(
    private readonly perplexitySearchClient: PerplexitySearchClient,
    private readonly missingCasinoRepository: MissingCasinoRepository,
    private readonly casinoRepository: CasinoRepository,
  ) {}

  /**
   * Discover casinos for a specific state
   * Queries Perplexity Search API, compares against cached Reel Edge data,
   * and stores missing casinos in the database
   */
  async discoverCasinosForState(
    state: StateAbbreviation,
    cachedReelEdgeData: ReelEdgeData,
  ): Promise<{
    discovered: number;
    missing: number;
    missingCasinos: MissingCasino[];
  }> {
    this.logger.log(`Starting casino discovery for state: ${state}`);

    try {
      const searchResult =
        await this.perplexitySearchClient.searchCasinos(state);

      const discoveredCasinos = searchResult.casinos;
      this.logger.log(
        `Discovered ${discoveredCasinos.length} casinos from Perplexity for ${state}`,
      );

      const existingCasinos = cachedReelEdgeData.casinos.filter(
        (casino) => casino.state === state,
      );
      this.logger.log(
        `Found ${existingCasinos.length} existing casinos in Reel Edge DB for ${state}`,
      );

      const missingCasinos = this.compareCasinoLists(
        discoveredCasinos,
        existingCasinos,
      );

      this.logger.log(
        `Identified ${missingCasinos.length} missing casinos for ${state}`,
      );

      const storedMissingCasinos: MissingCasino[] = [];

      for (const missingCasino of missingCasinos) {
        const alreadyExists =
          await this.missingCasinoRepository.existsByNameAndState(
            missingCasino.name,
            state,
          );

        if (!alreadyExists) {
          const source = this.extractSourceFromSearchResults(
            searchResult.searchResults,
            missingCasino.name,
          );

          const created = await this.missingCasinoRepository.create({
            name: missingCasino.name,
            state: missingCasino.state,
            source,
            website: missingCasino.website,
            regulatoryId: missingCasino.regulatoryId,
            promotionsFound: 0,
          });

          storedMissingCasinos.push(created);
          this.logger.debug(
            `Stored missing casino: ${missingCasino.name} (${state})`,
          );
        } else {
          this.logger.debug(
            `Skipping duplicate missing casino: ${missingCasino.name} (${state})`,
          );
        }
      }

      this.logger.log(
        `Completed casino discovery for ${state}: ${discoveredCasinos.length} discovered, ${storedMissingCasinos.length} new missing casinos stored`,
      );

      return {
        discovered: discoveredCasinos.length,
        missing: storedMissingCasinos.length,
        missingCasinos: storedMissingCasinos,
      };
    } catch (error) {
      this.logger.error(
        `Failed to discover casinos for state ${state}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Get missing casinos with filters and pagination
   */
  async getMissingCasinos(filters?: {
    state?: StateAbbreviation;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    casinos: MissingCasino[];
    total: number;
  }> {
    this.logger.debug('Fetching missing casinos with filters', filters);

    const casinos = await this.missingCasinoRepository.findAll(filters);
    const total = await this.missingCasinoRepository.count({
      state: filters?.state,
      search: filters?.search,
    });

    return { casinos, total };
  }

  /**
   * Compare discovered casinos against existing casinos
   * Uses fuzzy matching to handle name variations
   * Returns only truly missing casinos
   */
  compareCasinoLists(
    discovered: DiscoveredCasino[],
    existing: Casino[],
  ): DiscoveredCasino[] {
    const missing: DiscoveredCasino[] = [];

    for (const discoveredCasino of discovered) {
      const isMatch = existing.some((existingCasino) =>
        this.isCasinoMatch(discoveredCasino.name, existingCasino.name),
      );

      if (!isMatch) {
        missing.push(discoveredCasino);
      }
    }

    return missing;
  }

  /**
   * Enrich casino metadata using Perplexity
   * Gets additional details like website and regulatory ID
   */
  async enrichCasinoMetadata(
    casino: DiscoveredCasino,
  ): Promise<DiscoveredCasino> {
    this.logger.debug(`Enriching metadata for casino: ${casino.name}`);

    if (casino.website && casino.regulatoryId) {
      this.logger.debug(`Casino ${casino.name} already has complete metadata`);
      return casino;
    }

    try {
      const searchResult = await this.perplexitySearchClient.searchCasinos(
        casino.state,
      );

      const enrichedCasino = searchResult.casinos.find(
        (c) =>
          this.isCasinoMatch(c.name, casino.name) && c.state === casino.state,
      );

      if (enrichedCasino) {
        return {
          ...casino,
          website: casino.website || enrichedCasino.website,
          regulatoryId: casino.regulatoryId || enrichedCasino.regulatoryId,
        };
      }

      return casino;
    } catch (error) {
      this.logger.warn(
        `Failed to enrich metadata for casino ${casino.name}`,
        error instanceof Error ? error.message : String(error),
      );
      return casino;
    }
  }

  /**
   * Check if two casino names match using fuzzy matching
   * Handles name variations, abbreviations, and common differences
   */
  private isCasinoMatch(name1: string, name2: string): boolean {
    const normalized1 = this.normalizeCasinoName(name1);
    const normalized2 = this.normalizeCasinoName(name2);

    if (normalized1 === normalized2) {
      return true;
    }

    if (this.calculateSimilarity(normalized1, normalized2) >= 0.85) {
      return true;
    }

    if (this.isAbbreviationMatch(normalized1, normalized2)) {
      return true;
    }

    return false;
  }

  /**
   * Normalize casino name for comparison
   */
  private normalizeCasinoName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\b(casino|online|gaming|bet|sportsbook)\b/gi, '')
      .trim();
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Check if names match through abbreviations
   * E.g., "Caesars" vs "Caesars Palace", "MGM" vs "MGM Resorts"
   */
  private isAbbreviationMatch(name1: string, name2: string): boolean {
    const words1 = name1.split(/\s+/).filter((w) => w.length > 0);
    const words2 = name2.split(/\s+/).filter((w) => w.length > 0);

    if (words1.length === 0 || words2.length === 0) {
      return false;
    }

    const shorter = words1.length < words2.length ? words1 : words2;
    const longer = words1.length < words2.length ? words2 : words1;

    for (const shortWord of shorter) {
      const found = longer.some((longWord) => {
        if (shortWord === longWord) {
          return true;
        }

        if (
          shortWord.length >= 3 &&
          longWord.toLowerCase().startsWith(shortWord.toLowerCase())
        ) {
          return true;
        }

        return false;
      });

      if (!found) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract source from search results for a casino
   */
  private extractSourceFromSearchResults(
    searchResults: Array<{ title: string; url: string; snippet: string }>,
    casinoName: string,
  ): string {
    const normalizedName = this.normalizeCasinoName(casinoName);

    for (const result of searchResults) {
      const normalizedTitle = this.normalizeCasinoName(result.title);
      const normalizedSnippet = this.normalizeCasinoName(result.snippet);

      if (
        normalizedTitle.includes(normalizedName) ||
        normalizedSnippet.includes(normalizedName)
      ) {
        try {
          const url = new URL(result.url);
          return url.hostname;
        } catch {
          return result.url;
        }
      }
    }

    return 'Perplexity Search';
  }
}
