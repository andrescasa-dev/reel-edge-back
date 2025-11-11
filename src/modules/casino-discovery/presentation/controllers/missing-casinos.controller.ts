import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CasinoDiscoveryService } from '../../application/services/casino-discovery.service';
import { MissingCasinoQueryDto } from '../dtos/missing-casino-query.dto';
import {
  MissingCasinosListResponseDto,
  mapMissingCasinoToDto,
  PaginationDto,
} from '../dtos/missing-casino-response.dto';

/**
 * Missing Casinos Controller
 * Handles operations related to casinos found in regulatory sources but missing from database
 */
@ApiTags('Missing Casinos')
@Controller('missing-casinos')
export class MissingCasinosController {
  constructor(
    private readonly casinoDiscoveryService: CasinoDiscoveryService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List missing casinos',
    description:
      'Returns a list of casinos found in regulatory sources but not present in the database',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    enum: ['NJ', 'MI', 'PA', 'WV'],
    description: 'Filter by state abbreviation',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search casinos by name',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of results to return',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of results to skip',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    type: MissingCasinosListResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getMissingCasinos(
    @Query() query: MissingCasinoQueryDto,
  ): Promise<MissingCasinosListResponseDto> {
    const { limit = 50, offset = 0, state, search } = query;

    const result = await this.casinoDiscoveryService.getMissingCasinos({
      state,
      search,
      limit,
      offset,
    });

    const data = result.casinos.map(mapMissingCasinoToDto);

    const totalPages = Math.ceil(result.total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    const pagination: PaginationDto = {
      total: result.total,
      limit,
      page: currentPage,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrevious: currentPage > 1,
    };

    return {
      data,
      pagination,
    };
  }
}
