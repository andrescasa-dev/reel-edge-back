/**
 * Promotion domain entity
 * Represents a casino promotional offer
 */
export class Promotion {
  constructor(
    public readonly offerName: string,
    public readonly offerType: string,
    public readonly expectedDeposit: number,
    public readonly expectedBonus: number,
    public readonly termsAndConditions?: string,
    public readonly wageringRequirements?: string,
    public readonly validFrom?: Date,
    public readonly validUntil?: Date,
  ) {}

  /**
   * Create a Promotion entity from data object
   */
  static create(data: {
    offerName: string;
    offerType: string;
    expectedDeposit: number;
    expectedBonus: number;
    termsAndConditions?: string;
    wageringRequirements?: string;
    validFrom?: Date;
    validUntil?: Date;
  }): Promotion {
    return new Promotion(
      data.offerName,
      data.offerType,
      data.expectedDeposit,
      data.expectedBonus,
      data.termsAndConditions,
      data.wageringRequirements,
      data.validFrom,
      data.validUntil,
    );
  }

  /**
   * Calculate bonus-to-deposit ratio
   */
  getBonusRatio(): number {
    if (this.expectedDeposit === 0) {
      return this.expectedBonus > 0 ? Infinity : 0;
    }
    return this.expectedBonus / this.expectedDeposit;
  }

  /**
   * Check if promotion is currently valid
   */
  isValid(): boolean {
    const now = new Date();

    if (this.validFrom && now < this.validFrom) {
      return false;
    }

    if (this.validUntil && now > this.validUntil) {
      return false;
    }

    return true;
  }

  /**
   * Check if promotion is expired
   */
  isExpired(): boolean {
    if (!this.validUntil) {
      return false;
    }
    return new Date() > this.validUntil;
  }

  /**
   * Get formatted bonus display
   */
  getFormattedBonus(): string {
    return `$${this.expectedBonus} on $${this.expectedDeposit} deposit`;
  }

  /**
   * Convert to plain object
   */
  toObject(): {
    offerName: string;
    offerType: string;
    expectedDeposit: number;
    expectedBonus: number;
    termsAndConditions?: string;
    wageringRequirements?: string;
    validFrom?: Date;
    validUntil?: Date;
  } {
    return {
      offerName: this.offerName,
      offerType: this.offerType,
      expectedDeposit: this.expectedDeposit,
      expectedBonus: this.expectedBonus,
      termsAndConditions: this.termsAndConditions,
      wageringRequirements: this.wageringRequirements,
      validFrom: this.validFrom,
      validUntil: this.validUntil,
    };
  }
}
