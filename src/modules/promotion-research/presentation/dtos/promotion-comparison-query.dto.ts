import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ComparisonStatus } from '../../../shared/domain/enums/comparison-status.enum';
import { ComparisonType } from '../../../shared/domain/enums/comparison-type.enum';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';

/**
 * Promotion Comparison Query DTO
 */
export class PromotionComparisonQueryDto {
  @IsString()
  @IsOptional()
  casino?: string;

  @IsEnum(StateAbbreviation)
  @IsOptional()
  state?: StateAbbreviation;

  @IsString()
  @IsOptional()
  offer_type?: string;

  @IsEnum(ComparisonType)
  @IsOptional()
  insight?: ComparisonType;

  @IsEnum(ComparisonStatus)
  @IsOptional()
  status?: ComparisonStatus = ComparisonStatus.PENDING;

  @IsString()
  @IsOptional()
  promotion_id?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;
}
