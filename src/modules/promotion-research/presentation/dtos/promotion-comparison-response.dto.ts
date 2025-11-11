import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    enum: StateAbbreviation,
    description: 'Two-letter state code',
    example: 'NJ',
  })
  Abbreviation: StateAbbreviation;

  @ApiProperty({
    type: String,
    description: 'Full state name',
    example: 'New Jersey',
  })
  Name: string;
}

/**
 * Casino DTO matching API spec
 */
export class CasinoDto {
  @ApiProperty({
    type: Number,
    description: 'Casino database ID',
    example: 1,
  })
  casinodb_id: number;

  @ApiProperty({
    type: String,
    description: 'Casino name',
    example: 'Test Casino',
  })
  Name: string;

  @ApiProperty({ type: PromotionComparisonStateDto })
  state: PromotionComparisonStateDto;
}

/**
 * Promotion DTO matching API spec
 */
export class PromotionDto {
  @ApiProperty({
    type: String,
    description: 'Name of the promotional offer',
    example: 'Welcome Bonus',
  })
  Offer_Name: string;

  @ApiProperty({
    type: String,
    description:
      'Type of offer (e.g., Deposit Bonus, No Deposit Bonus, Free Spins)',
    example: 'Deposit Bonus',
  })
  offer_type: string;

  @ApiProperty({
    type: Number,
    description: 'Expected deposit amount required',
    example: 100,
  })
  Expected_Deposit: number;

  @ApiProperty({
    type: Number,
    description: 'Expected bonus amount',
    example: 50,
  })
  Expected_Bonus: number;

  @ApiProperty({
    type: String,
    description: 'Terms and conditions text',
    required: false,
    example: 'Standard terms apply',
  })
  terms_and_conditions?: string;

  @ApiProperty({
    type: String,
    description: 'Wagering requirements',
    required: false,
    example: '20x',
  })
  wagering_requirements?: string;

  @ApiProperty({
    type: Date,
    description: 'Promotion start date',
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  valid_from?: Date;

  @ApiProperty({
    type: Date,
    description: 'Promotion end date',
    required: false,
    example: '2024-12-31T23:59:59Z',
  })
  valid_until?: Date;
}

/**
 * Promotion Comparison Response DTO matching API spec
 */
export class PromotionComparisonResponseDto {
  @ApiProperty({
    type: String,
    description: 'Unique comparison identifier (6 char UUID)',
    example: 'comp-123',
  })
  id: string;

  @ApiProperty({ type: CasinoDto })
  casino: CasinoDto;

  @ApiProperty({
    type: PromotionDto,
    nullable: true,
    description:
      "Current promotion in database, null if comparison type is 'new'",
  })
  currentPromotion: PromotionDto | null;

  @ApiProperty({ type: PromotionDto })
  discoveredPromotion: PromotionDto;

  @ApiProperty({
    enum: ComparisonType,
    description: 'Type of insight about the discovered promotion',
    example: 'better',
  })
  comparisonType: ComparisonType;

  @ApiProperty({
    enum: ComparisonStatus,
    description: 'Current status of the comparison',
    example: 'pending',
  })
  status: ComparisonStatus;

  @ApiProperty({
    type: Date,
    description: 'When the comparison was created',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
    description: 'When the comparison was last updated',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;
}

/**
 * Pagination DTO
 */
export class PaginationDto {
  @ApiProperty({
    type: Number,
    description: 'Total number of items',
    example: 100,
  })
  total: number;

  @ApiProperty({
    type: Number,
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    type: Number,
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    type: Number,
    description: 'Total number of pages',
    example: 10,
  })
  totalPages: number;

  @ApiProperty({
    type: Boolean,
    description: 'Whether there is a next page',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPrevious: boolean;
}

/**
 * Promotion Comparisons List Response DTO
 */
export class PromotionComparisonsListResponseDto {
  @ApiProperty({ type: [PromotionComparisonResponseDto] })
  data: PromotionComparisonResponseDto[];

  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}

/**
 * Update Comparison Action Enum
 */
export enum UpdateComparisonAction {
  UPDATE = 'update',
  ADD = 'add',
  IGNORE = 'ignore',
}

/**
 * Update Comparison Request DTO
 */
export class UpdateComparisonDto {
  @ApiProperty({
    enum: UpdateComparisonAction,
    enumName: 'UpdateComparisonAction',
    description: 'Action to perform on the comparison',
    example: 'update',
  })
  @IsEnum(UpdateComparisonAction)
  @IsNotEmpty()
  action: UpdateComparisonAction;

  @ApiProperty({
    type: String,
    description: 'Optional notes about the action',
    required: false,
    example: 'Manually reviewed and updated',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Update Comparison Response DTO
 */
export class UpdateComparisonResponseDto {
  @ApiProperty({ type: Boolean, example: true })
  success: boolean;

  @ApiProperty({ type: String, example: 'Comparison updated successfully' })
  message: string;

  @ApiProperty({ type: PromotionComparisonResponseDto })
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
