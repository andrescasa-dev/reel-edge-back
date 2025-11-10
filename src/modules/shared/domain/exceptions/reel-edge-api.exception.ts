import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception thrown when Reel Edge API calls fail
 */
export class ReelEdgeAPIException extends HttpException {
  constructor(message: string, statusCode?: number) {
    super(
      {
        statusCode: statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        message: `Reel Edge API Error: ${message}`,
        timestamp: new Date().toISOString(),
      },
      statusCode || HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * Create exception for network errors
   */
  static networkError(originalError: Error): ReelEdgeAPIException {
    return new ReelEdgeAPIException(
      `Network error: ${originalError.message}`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * Create exception for timeout errors
   */
  static timeout(): ReelEdgeAPIException {
    return new ReelEdgeAPIException(
      'Request timeout',
      HttpStatus.REQUEST_TIMEOUT,
    );
  }

  /**
   * Create exception for invalid response format
   */
  static invalidResponse(details: string): ReelEdgeAPIException {
    return new ReelEdgeAPIException(
      `Invalid response format: ${details}`,
      HttpStatus.BAD_GATEWAY,
    );
  }

  /**
   * Create exception for API errors
   */
  static apiError(statusCode: number, message: string): ReelEdgeAPIException {
    return new ReelEdgeAPIException(
      `API returned ${statusCode}: ${message}`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}
