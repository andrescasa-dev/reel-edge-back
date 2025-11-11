import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Logger,
  ParseEnumPipe,
} from '@nestjs/common';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';
import { CasinoDiscoveryService } from '../../application/services/casino-discovery.service';
import { ReelEdgeDBClient } from '../../../shared/infrastructure/external-apis/reel-edge/reel-edge.client';
import { MissingCasinoQueryDto } from '../dtos/missing-casino-query.dto';
import { CompareCasinosDto } from '../dtos/compare-casinos.dto';
import { DiscoveredCasino } from '../../infrastructure/external-apis/perplexity/perplexity-search.types';
import { Casino } from '../../../shared/domain/entities/casino.entity';

/**
 * Casino Discovery Controller
 * Basic endpoints for testing Casino Discovery Service functionality
 */
@Controller('casino-discovery')
export class CasinoDiscoveryController {
  private readonly logger = new Logger(CasinoDiscoveryController.name);

  constructor(
    private readonly casinoDiscoveryService: CasinoDiscoveryService,
    private readonly reelEdgeClient: ReelEdgeDBClient,
  ) {}

  /**
   * POSTMAN EXAMPLE:
   * POST http://localhost:3000/casino-discovery/discover/NJ
   * Headers: Content-Type: application/json
   * Body: (empty)
   *
   * Discovers casinos for a specific state
   * - Fetches real ReelEdge data using ReelEdgeDBClient
   * - Calls Perplexity Search API to discover casinos
   * - Compares discovered casinos against existing ones
   * - Stores missing casinos in database
   * - Returns discovery results
   */
  @Post('discover/:state')
  async discoverCasinosForState(
    @Param('state', new ParseEnumPipe(StateAbbreviation))
    state: StateAbbreviation,
  ) {
    this.logger.log(`Starting casino discovery for state: ${state}`);

    try {
      const reelEdgeData = await this.reelEdgeClient.fetchAllActiveData();
      this.logger.log(
        `Fetched ${reelEdgeData.casinos.length} casinos from Reel Edge DB`,
      );

      const result = await this.casinoDiscoveryService.discoverCasinosForState(
        state,
        reelEdgeData,
      );

      return {
        success: true,
        state,
        discovered: result.discovered,
        missing: result.missing,
        missingCasinos: result.missingCasinos.map((casino) =>
          casino.toObject(),
        ),
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
   * POSTMAN EXAMPLE:
   * GET http://localhost:3000/casino-discovery/missing-casinos?state=NJ&search=Casino&limit=10&offset=0
   *
   * Lists missing casinos with filters and pagination
   * Query params:
   * - state (optional): NJ, MI, PA, WV
   * - search (optional): Search term for casino name
   * - limit (optional): Max results (default: 50, min: 1, max: 100)
   * - offset (optional): Number of results to skip (default: 0)
   */
  @Get('missing-casinos')
  async getMissingCasinos(@Query() query: MissingCasinoQueryDto) {
    this.logger.log('Fetching missing casinos', query);

    const filters = {
      state: query.state,
      search: query.search,
      limit: query.limit || 50,
      offset: query.offset || 0,
    };

    const result = await this.casinoDiscoveryService.getMissingCasinos(filters);

    return {
      success: true,
      data: result.casinos.map((casino) => casino.toObject()),
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  /**
   * POSTMAN EXAMPLE:
   * POST http://localhost:3000/casino-discovery/compare
   * Headers: Content-Type: application/json
   * Body:
   * {
   *   "discovered": [
   *     {
   *       "name": "Caesars Palace Casino",
   *       "state": "NJ",
   *       "website": "https://caesars.com"
   *     },
   *     {
   *       "name": "New Casino",
   *       "state": "NJ"
   *     }
   *   ],
   *   "existing": [
   *     {
   *       "casinodb_id": 1,
   *       "name": "Caesars",
   *       "state": "NJ"
   *     }
   *   ]
   * }
   *
   * Tests the comparison logic directly
   * - Accepts discovered and existing casino arrays
   * - Uses fuzzy matching to identify missing casinos
   * - Returns only truly missing casinos
   */
  @Post('compare')
  compareCasinos(@Body() compareDto: CompareCasinosDto) {
    this.logger.log(
      `Comparing ${compareDto.discovered.length} discovered vs ${compareDto.existing.length} existing casinos`,
    );

    const discovered: DiscoveredCasino[] = compareDto.discovered.map((d) => ({
      name: d.name,
      state: d.state,
      website: d.website,
      regulatoryId: d.regulatoryId,
    }));

    const existing: Casino[] = compareDto.existing.map((e) =>
      Casino.create({
        casinodb_id: e.casinodb_id,
        name: e.name,
        state: e.state,
        website: e.website,
        regulatoryId: e.regulatoryId,
      }),
    );

    const missing = this.casinoDiscoveryService.compareCasinoLists(
      discovered,
      existing,
    );

    return {
      success: true,
      discovered: compareDto.discovered.length,
      existing: compareDto.existing.length,
      missing: missing.length,
      missingCasinos: missing,
    };
  }
}
