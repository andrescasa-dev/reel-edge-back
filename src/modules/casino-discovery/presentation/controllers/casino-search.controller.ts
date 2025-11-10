import { Controller, Get } from '@nestjs/common';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';
import { PerplexitySearchClient } from '../../infrastructure/external-apis/perplexity';

@Controller('casinos')
export class CasinoSearchController {
  constructor(private readonly searchClient: PerplexitySearchClient) {}

  @Get('search')
  async searchAllStates() {
    const states = [
      StateAbbreviation.NJ,
      StateAbbreviation.MI,
      StateAbbreviation.PA,
      StateAbbreviation.WV,
    ];
    const results: Record<string, unknown> = {};

    for (const state of states) {
      results[state] = await this.searchClient.searchCasinos(state);
    }

    return results;
  }
}
