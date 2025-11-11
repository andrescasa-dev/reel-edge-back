import { ApiProperty } from '@nestjs/swagger';
import {
  StateAbbreviation,
  STATE_NAMES,
} from '../../../shared/domain/enums/state.enum';
import { MissingCasino } from '../../domain/entities/missing-casino.entity';

/**
 * State DTO for missing casino response
 */
export class MissingCasinoStateDto {
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
 * Missing Casino Response DTO matching API spec
 */
export class MissingCasinoResponseDto {
  @ApiProperty({
    type: String,
    description: 'Unique identifier',
    example: 'casino-123',
  })
  id: string;

  @ApiProperty({
    type: String,
    description: 'Casino name',
    example: 'Test Casino',
  })
  name: string;

  @ApiProperty({ type: MissingCasinoStateDto })
  state: MissingCasinoStateDto;

  @ApiProperty({
    type: String,
    description: 'Source where the casino was found',
    example: 'Gaming Commission',
  })
  source: string;

  @ApiProperty({
    type: Number,
    description: 'Number of promotions discovered for this casino',
    example: 3,
  })
  promotionsFound: number;

  @ApiProperty({
    type: Date,
    description: 'When the casino was first discovered',
    example: '2024-01-15T10:30:00Z',
  })
  discoveredAt: Date;

  @ApiProperty({
    type: String,
    description: 'Casino website URL',
    required: false,
    example: 'https://casino.com',
  })
  website?: string;

  @ApiProperty({
    type: String,
    description: 'Regulatory identification number',
    required: false,
    example: 'NJ-001',
  })
  regulatoryId?: string;
}

/**
 * Pagination DTO matching API spec
 */
export class PaginationDto {
  @ApiProperty({
    type: Number,
    description: 'Total number of items available',
    example: 100,
  })
  total: number;

  @ApiProperty({
    type: Number,
    description: 'Maximum number of items returned',
    example: 50,
  })
  limit: number;

  @ApiProperty({
    type: Number,
    description: 'Current page number (1-based)',
    example: 1,
  })
  page: number;

  @ApiProperty({
    type: Number,
    description: 'Total number of pages available',
    example: 2,
  })
  totalPages: number;

  @ApiProperty({
    type: Boolean,
    description: 'Whether there are more items available',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Whether there are previous items available',
    example: false,
  })
  hasPrevious: boolean;
}

/**
 * Missing Casinos List Response DTO
 */
export class MissingCasinosListResponseDto {
  @ApiProperty({ type: [MissingCasinoResponseDto] })
  data: MissingCasinoResponseDto[];

  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}

/**
 * Mapper function to convert MissingCasino entity to DTO
 */
export function mapMissingCasinoToDto(
  missingCasino: MissingCasino,
): MissingCasinoResponseDto {
  return {
    id: missingCasino.id,
    name: missingCasino.name,
    state: {
      Abbreviation: missingCasino.state,
      Name: STATE_NAMES[missingCasino.state],
    },
    source: missingCasino.source,
    promotionsFound: missingCasino.promotionsFound,
    discoveredAt: missingCasino.discoveredAt || new Date(),
    website: missingCasino.website,
    regulatoryId: missingCasino.regulatoryId,
  };
}
