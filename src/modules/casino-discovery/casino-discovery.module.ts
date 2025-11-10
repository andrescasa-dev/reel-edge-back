import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RateLimiterService } from '../shared/infrastructure/rate-limiting';
import { PerplexitySearchClient } from './infrastructure/external-apis/perplexity';
import { CasinoSearchController } from './presentation/controllers/casino-search.controller';

@Module({
  imports: [ConfigModule],
  controllers: [CasinoSearchController],
  providers: [PerplexitySearchClient, RateLimiterService],
  exports: [],
})
export class CasinoDiscoveryModule {}
