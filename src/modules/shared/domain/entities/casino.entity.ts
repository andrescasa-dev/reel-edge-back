import { StateAbbreviation } from '../enums/state.enum';

/**
 * Casino domain entity
 * Represents a casino from Reel Edge DB
 */
export class Casino {
  constructor(
    public readonly id: string,
    public readonly casinodb_id: number,
    public readonly name: string,
    public readonly state: StateAbbreviation,
    public readonly website?: string,
    public readonly regulatoryId?: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
  ) {}

  /**
   * Create a Casino entity from data object
   */
  static create(data: {
    id?: string;
    casinodb_id: number;
    name: string;
    state: StateAbbreviation;
    website?: string;
    regulatoryId?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): Casino {
    return new Casino(
      data.id || '',
      data.casinodb_id,
      data.name,
      data.state,
      data.website,
      data.regulatoryId,
      data.createdAt,
      data.updatedAt,
    );
  }

  /**
   * Get display name for casino
   */
  getDisplayName(): string {
    return `${this.name} (${this.state})`;
  }

  /**
   * Check if casino has complete information
   */
  hasCompleteInfo(): boolean {
    return Boolean(this.website && this.regulatoryId);
  }

  /**
   * Convert to plain object
   */
  toObject(): {
    id: string;
    casinodb_id: number;
    name: string;
    state: StateAbbreviation;
    website?: string;
    regulatoryId?: string;
    createdAt?: Date;
    updatedAt?: Date;
  } {
    return {
      id: this.id,
      casinodb_id: this.casinodb_id,
      name: this.name,
      state: this.state,
      website: this.website,
      regulatoryId: this.regulatoryId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
