import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ResearchOrchestrationModule } from '../research-orchestration/research-orchestration.module';
import { ReelEdgeDBClient } from '../shared/infrastructure/external-apis/reel-edge/reel-edge.client';
import { MissingCasinoRepository } from '../casino-discovery/infrastructure/repositories/missing-casino.repository';
import { PromotionComparisonRepository } from '../promotion-research/infrastructure/repositories/promotion-comparison.repository';
import { DashboardService } from './application/services/dashboard.service';
import { DashboardController } from './presentation/controllers/dashboard.controller';

@Module({
  imports: [ConfigModule, ResearchOrchestrationModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    ReelEdgeDBClient,
    MissingCasinoRepository,
    PromotionComparisonRepository,
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
