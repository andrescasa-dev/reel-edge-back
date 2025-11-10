/**
 * Test Data Builder
 * Provides factory functions to build test data objects
 */

export interface TestCasinoData {
  id?: string;
  casinodb_id: number;
  name: string;
  state: string;
  website?: string;
  regulatoryId?: string;
}

export interface TestMissingCasinoData {
  id?: string;
  name: string;
  state: string;
  source: string;
  website?: string;
  regulatoryId?: string;
  promotionsFound?: number;
}

export interface TestPromotionData {
  offerName: string;
  offerType: string;
  expectedDeposit: number;
  expectedBonus: number;
  termsAndConditions?: string;
  wageringRequirements?: string;
  validFrom?: Date;
  validUntil?: Date;
}

export interface TestPromotionComparisonData {
  id?: string;
  casinoId: string;
  currentOfferName?: string;
  currentOfferType?: string;
  currentExpectedDeposit?: number;
  currentExpectedBonus?: number;
  currentTermsAndConditions?: string;
  currentWageringRequirements?: string;
  discoveredOfferName: string;
  discoveredOfferType: string;
  discoveredExpectedDeposit: number;
  discoveredExpectedBonus: number;
  discoveredTermsAndConditions?: string;
  discoveredWageringRequirements?: string;
  discoveredValidFrom?: Date;
  discoveredValidUntil?: Date;
  comparisonType: string;
  status?: string;
  sources: string[];
  notes?: string;
}

export interface TestResearchJobData {
  id?: string;
  states: string[];
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  results?: object;
  errors?: object;
}

/**
 * Test Data Builders
 */
export class TestDataBuilder {
  /**
   * Build test casino data
   */
  static buildCasino(overrides: Partial<TestCasinoData> = {}): TestCasinoData {
    return {
      casinodb_id: Math.floor(Math.random() * 10000),
      name: 'Test Casino',
      state: 'NJ',
      website: 'https://testcasino.com',
      regulatoryId: 'REG-12345',
      ...overrides,
    };
  }

  /**
   * Build test missing casino data
   */
  static buildMissingCasino(
    overrides: Partial<TestMissingCasinoData> = {},
  ): TestMissingCasinoData {
    return {
      name: 'Missing Test Casino',
      state: 'NJ',
      source: 'https://source.com',
      website: 'https://missingcasino.com',
      regulatoryId: 'REG-67890',
      promotionsFound: 0,
      ...overrides,
    };
  }

  /**
   * Build test promotion data
   */
  static buildPromotion(
    overrides: Partial<TestPromotionData> = {},
  ): TestPromotionData {
    return {
      offerName: 'Welcome Bonus',
      offerType: 'Deposit Bonus',
      expectedDeposit: 100,
      expectedBonus: 200,
      termsAndConditions: 'Terms apply',
      wageringRequirements: '30x',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ...overrides,
    };
  }

  /**
   * Build test promotion comparison data
   */
  static buildPromotionComparison(
    overrides: Partial<TestPromotionComparisonData> = {},
  ): TestPromotionComparisonData {
    return {
      casinoId: 'test-casino-id',
      discoveredOfferName: 'New Welcome Bonus',
      discoveredOfferType: 'Deposit Bonus',
      discoveredExpectedDeposit: 100,
      discoveredExpectedBonus: 250,
      discoveredTermsAndConditions: 'New terms apply',
      discoveredWageringRequirements: '25x',
      comparisonType: 'better',
      status: 'pending',
      sources: ['https://source1.com', 'https://source2.com'],
      ...overrides,
    };
  }

  /**
   * Build test research job data
   */
  static buildResearchJob(
    overrides: Partial<TestResearchJobData> = {},
  ): TestResearchJobData {
    return {
      states: ['NJ', 'MI', 'PA', 'WV'],
      status: 'running',
      startedAt: new Date(),
      results: {},
      errors: {},
      ...overrides,
    };
  }

  /**
   * Build multiple test casinos
   */
  static buildCasinos(count: number): TestCasinoData[] {
    return Array.from({ length: count }, (_, i) =>
      this.buildCasino({
        casinodb_id: i + 1,
        name: `Test Casino ${i + 1}`,
      }),
    );
  }

  /**
   * Build multiple test missing casinos
   */
  static buildMissingCasinos(count: number): TestMissingCasinoData[] {
    return Array.from({ length: count }, (_, i) =>
      this.buildMissingCasino({
        name: `Missing Casino ${i + 1}`,
      }),
    );
  }
}
