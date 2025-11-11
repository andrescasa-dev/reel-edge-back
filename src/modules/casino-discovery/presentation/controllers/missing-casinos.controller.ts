import { Controller, Get, Query } from '@nestjs/common';
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
@Controller('missing-casinos')
export class MissingCasinosController {
  constructor(
    private readonly casinoDiscoveryService: CasinoDiscoveryService,
  ) {}

  @Get()
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
