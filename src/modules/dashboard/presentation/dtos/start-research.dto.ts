import { IsEnum, IsNotEmpty } from 'class-validator';

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
  @IsEnum(ResearchAction)
  @IsNotEmpty()
  action: ResearchAction;
}

/**
 * Research Status Response DTO
 */
export class ResearchStatusResponseDto {
  success: boolean;
  message: string;
  status: 'researching' | 'idle';
}
