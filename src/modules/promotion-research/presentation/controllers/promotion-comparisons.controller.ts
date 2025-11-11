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
@Controller('promotions/comparisons')
export class PromotionComparisonsController {
  constructor(
    private readonly promotionResearchService: PromotionResearchService,
    private readonly casinoRepository: CasinoRepository,
  ) {}

  @Get()
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
