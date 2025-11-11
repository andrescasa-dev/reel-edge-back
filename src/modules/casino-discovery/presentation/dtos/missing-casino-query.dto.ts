import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';

/**
 * Missing Casino Query DTO
 */
export class MissingCasinoQueryDto {
  @IsEnum(StateAbbreviation)
  @IsOptional()
  state?: StateAbbreviation;

  @IsString()
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 50;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}
