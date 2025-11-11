import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Configuration for rate limiting
 */
export interface RateLimiterConfig {
  requestsPerMinute: number;
  minDelayBetweenRequests?: number;
}

/**
 * Request metadata for tracking
 */
interface RequestMetadata {
  timestamp: number;
  completed: boolean;
}

/**
 * Service to handle rate limiting for API requests
 * Implements a sliding window algorithm with request queue
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly requestsPerMinute: number;
  private readonly minDelayMs: number;
  private readonly requestHistory: RequestMetadata[] = [];
  private readonly requestQueue: Array<{
    execute: () => Promise<void>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];
  private isProcessing = false;
  private lastRequestTime = 0;

  constructor(private readonly configService: ConfigService) {
    this.requestsPerMinute =
      this.configService.get<number>('PERPLEXITY_RATE_LIMIT_RPM') || 20;
    this.minDelayMs = 3000;
    this.logger.log(
      `Rate limiter initialized: ${this.requestsPerMinute} requests/minute, ${this.minDelayMs}ms min delay`,
    );
  }

  /**
   * Execute a function with rate limiting
   * Queues the request and processes it when rate limit allows
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        execute: fn as () => Promise<void>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests respecting rate limits
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      await this.waitForRateLimit();

      const request = this.requestQueue.shift();
      if (!request) {
        break;
      }

      try {
        const result = await request.execute();
        this.recordRequest();
        request.resolve(result);
      } catch (error) {
        this.logger.error('Request failed in rate limiter', error);
        request.reject(error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Wait until rate limit allows next request
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minDelayMs) {
      const delayNeeded = this.minDelayMs - timeSinceLastRequest;
      this.logger.debug(`Applying min delay: ${delayNeeded}ms`);
      await this.sleep(delayNeeded);
    }

    this.cleanOldRequests();

    const activeRequests = this.requestHistory.filter((req) => req.completed);

    if (activeRequests.length >= this.requestsPerMinute) {
      const oldestRequest = activeRequests[0];
      const timeSinceOldest = Date.now() - oldestRequest.timestamp;
      const timeToWait = 60000 - timeSinceOldest + 100;

      if (timeToWait > 0) {
        this.logger.warn(
          `Rate limit reached (${activeRequests.length}/${this.requestsPerMinute}). Waiting ${timeToWait}ms`,
        );
        await this.sleep(timeToWait);
        this.cleanOldRequests();
      }
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Record a completed request
   */
  private recordRequest(): void {
    this.requestHistory.push({
      timestamp: Date.now(),
      completed: true,
    });
  }

  /**
   * Remove requests older than 1 minute from history
   */
  private cleanOldRequests(): void {
    const cutoff = Date.now() - 60000;
    const initialLength = this.requestHistory.length;

    while (
      this.requestHistory.length > 0 &&
      this.requestHistory[0].timestamp < cutoff
    ) {
      this.requestHistory.shift();
    }

    const removed = initialLength - this.requestHistory.length;
    if (removed > 0) {
      this.logger.debug(`Cleaned ${removed} old requests from history`);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit statistics
   */
  getStats(): {
    requestsInLastMinute: number;
    queueLength: number;
    requestsPerMinute: number;
  } {
    this.cleanOldRequests();
    return {
      requestsInLastMinute: this.requestHistory.filter((req) => req.completed)
        .length,
      queueLength: this.requestQueue.length,
      requestsPerMinute: this.requestsPerMinute,
    };
  }

  /**
   * Handle 429 Too Many Requests response
   * Implements exponential backoff
   */
  async handleRateLimitError(retryAfter?: number): Promise<void> {
    const waitTime = retryAfter ? retryAfter * 1000 : 60000;
    this.logger.warn(
      `Received 429 Too Many Requests. Waiting ${waitTime}ms before retry`,
    );
    await this.sleep(waitTime);
  }
}
