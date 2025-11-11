import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception thrown when Perplexity API calls fail
 */
export class PerplexityAPIException extends HttpException {
  constructor(message: string, statusCode?: number) {
    super(
      {
        statusCode: statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        message: `Perplexity API Error: ${message}`,
        timestamp: new Date().toISOString(),
      },
      statusCode || HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * Create exception for network errors
   */
  static networkError(originalError: Error): PerplexityAPIException {
    return new PerplexityAPIException(
      `Network error: ${originalError.message}`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * Create exception for timeout errors
   */
  static timeout(): PerplexityAPIException {
    return new PerplexityAPIException(
      'Request timeout',
      HttpStatus.REQUEST_TIMEOUT,
    );
  }

  /**
   * Create exception for invalid response format
   */
  static invalidResponse(details: string): PerplexityAPIException {
    return new PerplexityAPIException(
      `Invalid response format: ${details}`,
      HttpStatus.BAD_GATEWAY,
    );
  }

  /**
   * Create exception for API errors
   */
  static apiError(statusCode: number, message: string): PerplexityAPIException {
    return new PerplexityAPIException(
      `API returned ${statusCode}: ${message}`,
      HttpStatus.BAD_GATEWAY,
    );
  }

  /**
   * Create exception for rate limit errors
   */
  static rateLimitExceeded(retryAfter?: number): PerplexityAPIException {
    const message = retryAfter
      ? `Rate limit exceeded. Retry after ${retryAfter} seconds`
      : 'Rate limit exceeded';
    return new PerplexityAPIException(message, HttpStatus.TOO_MANY_REQUESTS);
  }

  /**
   * Create exception for invalid API key
   */
  static invalidApiKey(): PerplexityAPIException {
    return new PerplexityAPIException(
      'Invalid API key',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
