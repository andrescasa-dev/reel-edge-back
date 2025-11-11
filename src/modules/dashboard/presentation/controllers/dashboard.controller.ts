import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { DashboardService } from '../../application/services/dashboard.service';
import {
  ResearchAction,
  ResearchStatusResponseDto,
  StartResearchDto,
} from '../dtos/start-research.dto';
import { StateStatsListResponseDto } from '../dtos/state-stats-response.dto';
import { mapStateStatsToDto } from '../mappers/state-stats.mapper';

/**
 * Dashboard Controller
 * Handles dashboard statistics and research status management
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('state-stats')
  async getStateStats(): Promise<StateStatsListResponseDto> {
    const stats = await this.dashboardService.getStateStats();
    const data = stats.map(mapStateStatsToDto);

    return {
      data,
      timestamp: new Date(),
    };
  }

  @Post('research-status')
  @HttpCode(HttpStatus.OK)
  async updateResearchStatus(
    @Body() dto: StartResearchDto,
  ): Promise<ResearchStatusResponseDto> {
    if (dto.action === ResearchAction.START) {
      return await this.dashboardService.startResearch();
    } else {
      return await this.dashboardService.stopResearch();
    }
  }
}
