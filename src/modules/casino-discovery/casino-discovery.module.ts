import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RateLimiterService } from '../shared/infrastructure/rate-limiting';
import { CasinoRepository } from '../shared/infrastructure/repositories/casino.repository';
import { PerplexitySearchClient } from './infrastructure/external-apis/perplexity';
import { MissingCasinoRepository } from './infrastructure/repositories/missing-casino.repository';
import { CasinoDiscoveryService } from './application/services/casino-discovery.service';
import { CasinoSearchController } from './presentation/controllers/casino-search.controller';
import { MissingCasinosController } from './presentation/controllers/missing-casinos.controller';

@Module({
  imports: [ConfigModule],
  controllers: [CasinoSearchController, MissingCasinosController],
  providers: [
    PerplexitySearchClient,
    RateLimiterService,
    CasinoDiscoveryService,
    MissingCasinoRepository,
    CasinoRepository,
  ],
  exports: [CasinoDiscoveryService],
})
export class CasinoDiscoveryModule {}
