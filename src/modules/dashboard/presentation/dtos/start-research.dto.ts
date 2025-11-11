import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Research action enum
 */
export enum ResearchAction {
  START = 'start',
  STOP = 'stop',
}

/**
 * Start Research Request DTO
 */
export class StartResearchDto {
  @ApiProperty({
    enum: ResearchAction,
    enumName: 'ResearchAction',
    description: 'Action to perform - starts or stops research for all states',
    example: 'start',
  })
  @IsEnum(ResearchAction)
  @IsNotEmpty()
  action: ResearchAction;
}

/**
 * Research Status Response DTO
 */
export class ResearchStatusResponseDto {
  @ApiProperty({ type: Boolean, example: true })
  success: boolean;

  @ApiProperty({ type: String, example: 'Research started successfully' })
  message: string;

  @ApiProperty({
    enum: ['researching', 'idle'],
    description: 'Global research status for all states',
    example: 'researching',
  })
  status: 'researching' | 'idle';
}
