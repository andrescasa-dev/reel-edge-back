import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RateLimiterService } from '../shared/infrastructure/rate-limiting';
import { CasinoRepository } from '../shared/infrastructure/repositories/casino.repository';
import { PerplexitySonarClient } from './infrastructure/external-apis/perplexity';
import { PromotionComparisonRepository } from './infrastructure/repositories/promotion-comparison.repository';
import { PromotionResearchService } from './application/services/promotion-research.service';
import { PromotionResearchController } from './presentation/controllers/promotion-research.controller';

@Module({
  imports: [ConfigModule],
  controllers: [PromotionResearchController],
  providers: [
    PerplexitySonarClient,
    RateLimiterService,
    PromotionResearchService,
    PromotionComparisonRepository,
    CasinoRepository,
  ],
  exports: [PromotionResearchService],
})
export class PromotionResearchModule {}
