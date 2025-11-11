import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';

/**
 * Missing Casino domain entity
 * Represents a casino discovered but not present in Reel Edge DB
 */
export class MissingCasino {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly state: StateAbbreviation,
    public readonly source: string,
    public readonly website?: string,
    public readonly regulatoryId?: string,
    public readonly promotionsFound: number = 0,
    public readonly discoveredAt?: Date,
  ) {}

  /**
   * Create a MissingCasino entity from data object
   */
  static create(data: {
    id?: string;
    name: string;
    state: StateAbbreviation;
    source: string;
    website?: string;
    regulatoryId?: string;
    promotionsFound?: number;
    discoveredAt?: Date;
  }): MissingCasino {
    return new MissingCasino(
      data.id || '',
      data.name,
      data.state,
      data.source,
      data.website,
      data.regulatoryId,
      data.promotionsFound || 0,
      data.discoveredAt || new Date(),
    );
  }

  /**
   * Check if casino has promotions
   */
  hasPromotions(): boolean {
    return this.promotionsFound > 0;
  }

  /**
   * Check if casino has complete information
   */
  hasCompleteInfo(): boolean {
    return Boolean(this.website && this.regulatoryId);
  }

  /**
   * Get display name for missing casino
   */
  getDisplayName(): string {
    return `${this.name} (${this.state})`;
  }

  /**
   * Convert to plain object
   */
  toObject(): {
    id: string;
    name: string;
    state: StateAbbreviation;
    source: string;
    website?: string;
    regulatoryId?: string;
    promotionsFound: number;
    discoveredAt?: Date;
  } {
    return {
      id: this.id,
      name: this.name,
      state: this.state,
      source: this.source,
      website: this.website,
      regulatoryId: this.regulatoryId,
      promotionsFound: this.promotionsFound,
      discoveredAt: this.discoveredAt,
    };
  }
}
