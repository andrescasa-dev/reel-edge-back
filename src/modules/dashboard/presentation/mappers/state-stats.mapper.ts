import { StateStats } from '../../application/services/dashboard.service';
import { StateStatsResponseDto } from '../dtos/state-stats-response.dto';

/**
 * Map StateStats to StateStatsResponseDto
 */
export function mapStateStatsToDto(stats: StateStats): StateStatsResponseDto {
  return {
    state: stats.state,
    casinosTracked: stats.casinosTracked,
    promotionsActive: stats.promotionsActive,
    lastUpdated: stats.lastUpdated,
    status: stats.status,
    missingCasinos: stats.missingCasinos,
    pendingComparisons: stats.pendingComparisons,
  };
}
