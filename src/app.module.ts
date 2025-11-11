import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configuration } from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { CasinoDiscoveryModule } from './modules/casino-discovery/casino-discovery.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PromotionResearchModule } from './modules/promotion-research/promotion-research.module';
import { ResearchOrchestrationModule } from './modules/research-orchestration/research-orchestration.module';
import { SharedModule } from './modules/shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    SharedModule,
    DashboardModule,
    CasinoDiscoveryModule,
    PromotionResearchModule,
    ResearchOrchestrationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
