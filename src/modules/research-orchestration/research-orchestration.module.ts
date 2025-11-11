import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CasinoDiscoveryModule } from '../casino-discovery/casino-discovery.module';
import { PromotionResearchModule } from '../promotion-research/promotion-research.module';
import { ReelEdgeDBClient } from '../shared/infrastructure/external-apis/reel-edge/reel-edge.client';
import { CasinoRepository } from '../shared/infrastructure/repositories/casino.repository';
import { SharedModule } from '../shared/shared.module';
import { ResearchOrchestrationService } from './application/services/research-orchestration.service';
import { ResearchJobRepository } from './infrastructure/repositories/research-job.repository';
import { ScheduledJobRepository } from './infrastructure/repositories/scheduled-job.repository';
import { PgJobScheduler } from './infrastructure/scheduler/pg-job-scheduler';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    SharedModule,
    CasinoDiscoveryModule,
    PromotionResearchModule,
  ],
  controllers: [],
  providers: [
    ReelEdgeDBClient,
    CasinoRepository,
    ResearchJobRepository,
    ScheduledJobRepository,
    ResearchOrchestrationService,
    PgJobScheduler,
  ],
  exports: [ResearchOrchestrationService],
})
export class ResearchOrchestrationModule {}
