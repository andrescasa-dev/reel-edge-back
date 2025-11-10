import { Injectable, Logger } from '@nestjs/common';
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

/**
 * Configuration options for HTTP client
 */
export interface HttpClientConfig {
  baseURL: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Generic HTTP client with retry logic and error handling
 * Handles all Axios configuration and concerns
 */
@Injectable()
export class HttpClient {
  private readonly logger: Logger;
  private readonly axiosInstance: AxiosInstance;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    config: HttpClientConfig,
    loggerContext: string = HttpClient.name,
  ) {
    this.logger = new Logger(loggerContext);
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;

    this.logger.log(
      `Initializing HTTP client with base URL: ${config.baseURL}`,
    );

    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup Axios interceptors for logging and error handling
   */
  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        this.logger.debug(`Making request to: ${config.url}`);
        return config;
      },
      (error: AxiosError) => {
        this.logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      },
    );

    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        this.logger.debug(
          `Received response from ${response.config.url} with status ${response.status}`,
        );
        return response;
      },
      (error: AxiosError) => {
        if (error.response) {
          this.logger.error(
            `Response error from ${error.config?.url}: ${error.response.status}`,
          );
        } else if (error.request) {
          this.logger.error(`No response received from ${error.config?.url}`);
        } else {
          this.logger.error(`Request setup error: ${error.message}`);
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * Perform GET request with retry logic
   */
  async get<T>(
    endpoint: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.fetchWithRetry<T>(() =>
      this.axiosInstance.get<T>(endpoint, config),
    );
  }

  /**
   * Perform POST request with retry logic
   */
  async post<T>(
    endpoint: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.fetchWithRetry<T>(() =>
      this.axiosInstance.post<T>(endpoint, data, config),
    );
  }

  /**
   * Perform PUT request with retry logic
   */
  async put<T>(
    endpoint: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.fetchWithRetry<T>(() =>
      this.axiosInstance.put<T>(endpoint, data, config),
    );
  }

  /**
   * Perform DELETE request with retry logic
   */
  async delete<T>(
    endpoint: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.fetchWithRetry<T>(() =>
      this.axiosInstance.delete<T>(endpoint, config),
    );
  }

  /**
   * Execute request with retry logic and exponential backoff
   */
  private async fetchWithRetry<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    attempt: number = 1,
  ): Promise<AxiosResponse<T>> {
    try {
      const response = await requestFn();
      return response;
    } catch (error) {
      if (attempt >= this.maxRetries) {
        this.logger.error(`Max retries (${this.maxRetries}) reached`);
        throw error;
      }

      const isRetryable = this.isRetryableError(error as AxiosError);

      if (!isRetryable) {
        this.logger.error('Non-retryable error encountered', error);
        throw error;
      }

      const delay = this.calculateBackoffDelay(attempt);
      this.logger.warn(
        `Retry attempt ${attempt}/${this.maxRetries} after ${delay}ms`,
      );

      await this.sleep(delay);
      return this.fetchWithRetry<T>(requestFn, attempt + 1);
    }
  }

  /**
   * Check if error is retryable (5xx, 429, 408, or network errors)
   */
  private isRetryableError(error: AxiosError): boolean {
    if (!error.response) {
      return true;
    }

    const status = error.response.status;
    return status >= 500 || status === 429 || status === 408;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    return this.retryDelay * Math.pow(2, attempt - 1);
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error is an Axios error
   */
  isAxiosError(error: unknown): error is AxiosError {
    return axios.isAxiosError(error);
  }
}
