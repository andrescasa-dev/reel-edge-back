export class MissingCasinoNotFoundException extends Error {
  constructor(missingCasinoId: string) {
    super(`Missing casino not found with id: ${missingCasinoId}`);
    this.name = 'MissingCasinoNotFoundException';
    Error.captureStackTrace(this, this.constructor);
  }
}
