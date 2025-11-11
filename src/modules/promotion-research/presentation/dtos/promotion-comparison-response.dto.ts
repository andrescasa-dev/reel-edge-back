import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Casino } from '../../../shared/domain/entities/casino.entity';
import { ComparisonStatus } from '../../../shared/domain/enums/comparison-status.enum';
import { ComparisonType } from '../../../shared/domain/enums/comparison-type.enum';
import {
  STATE_NAMES,
  StateAbbreviation,
} from '../../../shared/domain/enums/state.enum';
import { PromotionComparison } from '../../domain/entities/promotion-comparison.entity';
import { Promotion } from '../../domain/entities/promotion.entity';

/**
 * State DTO for promotion comparison response
 */
export class PromotionComparisonStateDto {
  Abbreviation: StateAbbreviation;
  Name: string;
}

/**
 * Casino DTO matching API spec
 */
export class CasinoDto {
  casinodb_id: number;
  Name: string;
  state: PromotionComparisonStateDto;
}

/**
 * Promotion DTO matching API spec
 */
export class PromotionDto {
  Offer_Name: string;
  offer_type: string;
  Expected_Deposit: number;
  Expected_Bonus: number;
  terms_and_conditions?: string;
  wagering_requirements?: string;
  valid_from?: Date;
  valid_until?: Date;
}

/**
 * Promotion Comparison Response DTO matching API spec
 */
export class PromotionComparisonResponseDto {
  id: string;
  casino: CasinoDto;
  currentPromotion: PromotionDto | null;
  discoveredPromotion: PromotionDto;
  comparisonType: ComparisonType;
  status: ComparisonStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Promotion Comparisons List Response DTO
 */
export class PromotionComparisonsListResponseDto {
  data: PromotionComparisonResponseDto[];
  pagination: {
    total: number;
    limit: number;
    page: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Update Comparison Request DTO
 */
export class UpdateComparisonDto {
  @IsEnum(['update', 'add', 'ignore'])
  action: 'update' | 'add' | 'ignore';

  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Update Comparison Response DTO
 */
export class UpdateComparisonResponseDto {
  success: boolean;
  message: string;
  comparison: PromotionComparisonResponseDto;
}

/**
 * Mapper function to convert Promotion entity to DTO
 */
function mapPromotionToDto(promotion: Promotion): PromotionDto {
  return {
    Offer_Name: promotion.offerName,
    offer_type: promotion.offerType,
    Expected_Deposit: promotion.expectedDeposit,
    Expected_Bonus: promotion.expectedBonus,
    terms_and_conditions: promotion.termsAndConditions,
    wagering_requirements: promotion.wageringRequirements,
    valid_from: promotion.validFrom,
    valid_until: promotion.validUntil,
  };
}

/**
 * Mapper function to convert PromotionComparison entity to DTO
 * Note: This requires the casino entity to be loaded
 */
export function mapPromotionComparisonToDto(
  comparison: PromotionComparison,
  casino: Casino,
): PromotionComparisonResponseDto {
  return {
    id: comparison.id,
    casino: {
      casinodb_id: casino.casinodb_id,
      Name: casino.name,
      state: {
        Abbreviation: casino.state,
        Name: STATE_NAMES[casino.state],
      },
    },
    currentPromotion: comparison.currentPromotion
      ? mapPromotionToDto(comparison.currentPromotion)
      : null,
    discoveredPromotion: mapPromotionToDto(comparison.discoveredPromotion),
    comparisonType: comparison.comparisonType,
    status: comparison.status,
    createdAt: comparison.createdAt || new Date(),
    updatedAt: comparison.updatedAt || new Date(),
  };
}
