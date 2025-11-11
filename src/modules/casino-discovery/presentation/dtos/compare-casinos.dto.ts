import {
  IsArray,
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';

/**
 * DTO for discovered casino in compare request
 */
export class DiscoveredCasinoDto {
  @IsString()
  name: string;

  @IsEnum(StateAbbreviation)
  state: StateAbbreviation;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  regulatoryId?: string;
}

/**
 * DTO for existing casino in compare request
 */
export class ExistingCasinoDto {
  @IsInt()
  casinodb_id: number;

  @IsString()
  name: string;

  @IsEnum(StateAbbreviation)
  state: StateAbbreviation;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  regulatoryId?: string;
}

/**
 * DTO for comparing discovered vs existing casinos
 */
export class CompareCasinosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscoveredCasinoDto)
  discovered: DiscoveredCasinoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExistingCasinoDto)
  existing: ExistingCasinoDto[];
}
