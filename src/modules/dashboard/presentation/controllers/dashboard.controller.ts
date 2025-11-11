import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
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
@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('state-stats')
  @ApiOperation({
    summary: 'Get state-level statistics',
    description:
      'Returns aggregated statistics for all states including casino counts, promotion counts, and research status. The research status field indicates the global research status that applies to all states.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    type: StateStatsListResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
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
  @ApiOperation({
    summary: 'Update global research status',
    description:
      'Triggers or stops research process for all states (NJ, MI, PA, WV) simultaneously',
  })
  @ApiBody({ type: StartResearchDto })
  @ApiResponse({
    status: 200,
    description: 'Research status updated successfully',
    type: ResearchStatusResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
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
