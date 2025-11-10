import { Body, Controller, Post } from '@nestjs/common';
import { Casino } from '../../../shared/domain/entities/casino.entity';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';
import { PerplexitySonarClient } from '../../infrastructure/external-apis/perplexity';

@Controller('promotions')
export class PromotionResearchController {
  constructor(private readonly sonarClient: PerplexitySonarClient) {}

  @Post('research')
  async researchPromotions(
    @Body()
    body: {
      casinos: Array<{ name: string; state: StateAbbreviation }>;
    },
  ) {
    const casinoEntities = body.casinos.map((c) =>
      Casino.create({ casinodb_id: 0, name: c.name, state: c.state }),
    );

    return await this.sonarClient.queryPromotionsBatch(
      casinoEntities,
      new Map(),
    );
  }
}

