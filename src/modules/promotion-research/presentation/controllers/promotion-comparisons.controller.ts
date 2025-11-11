import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CasinoRepository } from '../../../shared/infrastructure/repositories/casino.repository';
import { PromotionResearchService } from '../../application/services/promotion-research.service';
import { PromotionComparisonQueryDto } from '../dtos/promotion-comparison-query.dto';
import {
  PromotionComparisonsListResponseDto,
  UpdateComparisonDto,
  UpdateComparisonResponseDto,
  mapPromotionComparisonToDto,
} from '../dtos/promotion-comparison-response.dto';

/**
 * Promotion Comparisons Controller
 * Handles promotion comparison and management endpoints
 */
@ApiTags('Promotions')
@Controller('promotions/comparisons')
export class PromotionComparisonsController {
  constructor(
    private readonly promotionResearchService: PromotionResearchService,
    private readonly casinoRepository: CasinoRepository,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List promotion comparisons',
    description:
      'Returns a list of promotion comparisons between current database promotions and newly discovered promotions',
  })
  @ApiQuery({
    name: 'casino',
    required: false,
    type: String,
    description: 'Filter by casino name',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    enum: ['NJ', 'MI', 'PA', 'WV'],
    description: 'Filter by state abbreviation',
  })
  @ApiQuery({
    name: 'offer_type',
    required: false,
    type: String,
    description: 'Filter by offer type',
  })
  @ApiQuery({
    name: 'insight',
    required: false,
    enum: ['better', 'alternative', 'new'],
    description: 'Filter by comparison insight type',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'updated', 'reviewed', 'ignored'],
    description: 'Filter by comparison status',
    example: 'pending',
  })
  @ApiQuery({
    name: 'promotion_id',
    required: false,
    type: String,
    description: 'Search by promotion ID',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of results to return',
    example: 10,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-based)',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    type: PromotionComparisonsListResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getPromotionComparisons(
    @Query() query: PromotionComparisonQueryDto,
  ): Promise<PromotionComparisonsListResponseDto> {
    const {
      limit = 10,
      page = 1,
      state,
      offer_type,
      insight,
      status,
      promotion_id,
      casino: casinoName,
    } = query;

    const offset = (page - 1) * limit;

    let casinoId: string | undefined;
    if (casinoName) {
      const casinos = await this.casinoRepository.findAll();
      const matchingCasino = casinos.find(
        (c) => c.name.toLowerCase() === casinoName.toLowerCase(),
      );
      if (matchingCasino) {
        casinoId = matchingCasino.id;
      } else {
        return {
          data: [],
          pagination: {
            total: 0,
            limit,
            page,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
          },
        };
      }
    }

    const result = await this.promotionResearchService.getPromotionComparisons({
      casinoId,
      state,
      offerType: offer_type,
      comparisonType: insight,
      status,
      promotionId: promotion_id,
      limit,
      offset,
    });

    const data = await Promise.all(
      result.comparisons.map(async (comparison) => {
        const casino = await this.casinoRepository.findById(
          comparison.casinoId,
        );
        if (!casino) {
          throw new Error(`Casino not found: ${comparison.casinoId}`);
        }
        return mapPromotionComparisonToDto(comparison, casino);
      }),
    );

    const totalPages = Math.ceil(result.total / limit);

    return {
      data,
      pagination: {
        total: result.total,
        limit,
        page,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  @Patch(':comparisonId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update promotion comparison status',
    description:
      'Updates the status of a promotion comparison (update, add, ignore)',
  })
  @ApiParam({
    name: 'comparisonId',
    description: 'Unique identifier of the promotion comparison',
    type: String,
  })
  @ApiBody({ type: UpdateComparisonDto })
  @ApiResponse({
    status: 200,
    description: 'Comparison updated successfully',
    type: UpdateComparisonResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters',
  })
  @ApiResponse({
    status: 404,
    description: 'Resource not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async updatePromotionComparison(
    @Param('comparisonId') comparisonId: string,
    @Body() dto: UpdateComparisonDto,
  ): Promise<UpdateComparisonResponseDto> {
    const updated = await this.promotionResearchService.updateComparisonStatus(
      comparisonId,
      dto.action,
      dto.notes,
    );

    const casino = await this.casinoRepository.findById(updated.casinoId);
    if (!casino) {
      throw new Error(`Casino not found: ${updated.casinoId}`);
    }

    return {
      success: true,
      message: 'Comparison updated successfully',
      comparison: mapPromotionComparisonToDto(updated, casino),
    };
  }
}
