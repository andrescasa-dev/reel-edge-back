export class CasinoNotFoundException extends Error {
  constructor(identifier: string, identifierType: 'id' | 'casinodb_id' = 'id') {
    super(`Casino not found with ${identifierType}: ${identifier}`);
    this.name = 'CasinoNotFoundException';
    Error.captureStackTrace(this, this.constructor);
  }
}
