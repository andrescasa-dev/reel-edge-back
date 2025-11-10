import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RateLimiterService } from '../shared/infrastructure/rate-limiting';
import { PerplexitySonarClient } from './infrastructure/external-apis/perplexity';
import { PromotionResearchController } from './presentation/controllers/promotion-research.controller';

@Module({
  imports: [ConfigModule],
  controllers: [PromotionResearchController],
  providers: [PerplexitySonarClient, RateLimiterService],
  exports: [],
})
export class PromotionResearchModule {}
