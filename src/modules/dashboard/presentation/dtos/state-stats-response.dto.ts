import { ApiProperty } from '@nestjs/swagger';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';
import { ResearchStatus } from '../../../shared/domain/enums/research-status.enum';

/**
 * State DTO matching API spec
 */
export class StateDto {
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
 * State Stats Response DTO matching API spec
 */
export class StateStatsResponseDto {
  @ApiProperty({ type: StateDto })
  state: StateDto;

  @ApiProperty({
    type: Number,
    description: 'Number of casinos currently being tracked',
    example: 25,
  })
  casinosTracked: number;

  @ApiProperty({
    type: Number,
    description: 'Number of active promotions',
    example: 50,
  })
  promotionsActive: number;

  @ApiProperty({
    type: Date,
    description: 'Timestamp of last data update',
    example: '2024-01-15T10:30:00Z',
  })
  lastUpdated: Date;

  @ApiProperty({
    enum: ResearchStatus,
    description: 'Current research status',
    example: 'idle',
  })
  status: ResearchStatus;

  @ApiProperty({
    type: Number,
    description: 'Number of casinos found but not in database',
    required: false,
    example: 5,
  })
  missingCasinos?: number;

  @ApiProperty({
    type: Number,
    description: 'Number of pending promotion comparisons',
    required: false,
    example: 10,
  })
  pendingComparisons?: number;
}

/**
 * Response wrapper for state stats endpoint
 */
export class StateStatsListResponseDto {
  @ApiProperty({ type: [StateStatsResponseDto] })
  data: StateStatsResponseDto[];

  @ApiProperty({ type: Date, example: '2024-01-15T10:30:00Z' })
  timestamp: Date;
}
