import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { StateAbbreviation } from '../../../../../shared/domain/enums/state.enum';
import { PerplexityAPIException } from '../../../../../shared/domain/exceptions';
import { HttpClient } from '../../../../../shared/infrastructure/external-apis/http-client';
import { RateLimiterService } from '../../../../../shared/infrastructure/rate-limiting';
import { PerplexitySearchClient } from '../perplexity-search.client';

describe('PerplexitySearchClient', () => {
  let client: PerplexitySearchClient;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockRateLimiter: jest.Mocked<RateLimiterService>;

  const mockAxiosConfig: InternalAxiosRequestConfig = {
    headers: {
      'Content-Type': 'application/json',
    },
  } as InternalAxiosRequestConfig;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string | number> = {
        PERPLEXITY_API_KEY: 'test-api-key',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      isAxiosError: jest.fn(),
    } as unknown as jest.Mocked<HttpClient>;

    mockRateLimiter = {
      execute: jest.fn().mockImplementation(<T>(fn: () => T) => fn()),
      handleRateLimitError: jest.fn(),
      getStats: jest.fn(),
    } as unknown as jest.Mocked<RateLimiterService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerplexitySearchClient,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RateLimiterService,
          useValue: mockRateLimiter,
        },
      ],
    }).compile();

    client = module.get<PerplexitySearchClient>(PerplexitySearchClient);

    Object.defineProperty(client, 'httpClient', {
      value: mockHttpClient,
      writable: true,
    });
  });

  describe('searchCasinos', () => {
    it('should successfully search and parse casinos for a state', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-1',
          model: 'llama-3.1-sonar-small-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `Here are the licensed casinos in New Jersey:
                
                [
                  {
                    "name": "BetMGM Casino",
                    "website": "https://betmgm.com",
                    "regulatoryId": "NJ-001"
                  },
                  {
                    "name": "DraftKings Casino",
                    "website": "https://draftkings.com"
                  }
                ]`,
              },
              finish_reason: 'stop',
            },
          ],
          citations: [
            'https://nj.gov/gaming',
            'https://betmgm.com',
            'https://draftkings.com',
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: mockAxiosConfig,
      };

      mockHttpClient.post.mockResolvedValue(mockResponse);

      const result = await client.searchCasinos(StateAbbreviation.NJ);

      expect(result.casinos).toHaveLength(2);
      expect(result.casinos[0]).toEqual({
        name: 'BetMGM Casino',
        website: 'https://betmgm.com',
        regulatoryId: 'NJ-001',
        state: StateAbbreviation.NJ,
      });
      expect(result.casinos[1]).toEqual({
        name: 'DraftKings Casino',
        website: 'https://draftkings.com',
        regulatoryId: undefined,
        state: StateAbbreviation.NJ,
      });
      expect(result.citations).toHaveLength(3);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRateLimiter.execute).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/chat/completions',
        expect.objectContaining({
          model: 'llama-3.1-sonar-small-128k-online',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
            }),
          ]),
        }),
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('should return empty array when no casinos found', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-2',
          model: 'llama-3.1-sonar-small-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'No licensed casinos found. []',
              },
              finish_reason: 'stop',
            },
          ],
          citations: [],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: mockAxiosConfig,
      };

      mockHttpClient.post.mockResolvedValue(mockResponse);

      const result = await client.searchCasinos(StateAbbreviation.WV);

      expect(result.casinos).toHaveLength(0);
      expect(result.citations).toHaveLength(0);
    });

    it('should handle websites without protocol', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-3',
          model: 'llama-3.1-sonar-small-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `[
                  {
                    "name": "Test Casino",
                    "website": "testcasino.com"
                  }
                ]`,
              },
              finish_reason: 'stop',
            },
          ],
          citations: [],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: mockAxiosConfig,
      };

      mockHttpClient.post.mockResolvedValue(mockResponse);

      const result = await client.searchCasinos(StateAbbreviation.PA);

      expect(result.casinos[0].website).toBe('https://testcasino.com');
    });

    it('should clean casino names properly', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-4',
          model: 'llama-3.1-sonar-small-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `[
                  {
                    "name": "  Casino   Name  ",
                    "website": "https://casino.com"
                  },
                  {
                    "name": "\\"Quoted Casino\\"",
                    "website": "https://quoted.com"
                  }
                ]`,
              },
              finish_reason: 'stop',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: mockAxiosConfig,
      };

      mockHttpClient.post.mockResolvedValue(mockResponse);

      const result = await client.searchCasinos(StateAbbreviation.MI);

      expect(result.casinos[0].name).toBe('Casino Name');
      expect(result.casinos[1].name).toBe('Quoted Casino');
    });

    it('should return empty array when no valid JSON found in response', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-5',
          model: 'llama-3.1-sonar-small-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'This is not valid JSON',
              },
              finish_reason: 'stop',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: mockAxiosConfig,
      };

      mockHttpClient.post.mockResolvedValue(mockResponse);

      const result = await client.searchCasinos(StateAbbreviation.NJ);

      expect(result.casinos).toHaveLength(0);
      expect(result.citations).toHaveLength(0);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout',
        isAxiosError: true,
      } as AxiosError;

      mockHttpClient.post.mockRejectedValue(timeoutError);
      mockHttpClient.isAxiosError.mockReturnValue(true);

      await expect(client.searchCasinos(StateAbbreviation.NJ)).rejects.toThrow(
        PerplexityAPIException,
      );
      await expect(client.searchCasinos(StateAbbreviation.NJ)).rejects.toThrow(
        /Request timeout/,
      );
    });

    it('should handle network errors', async () => {
      const networkError = {
        message: 'Network error',
        isAxiosError: true,
        response: undefined,
      } as AxiosError;

      mockHttpClient.post.mockRejectedValue(networkError);
      mockHttpClient.isAxiosError.mockReturnValue(true);

      await expect(client.searchCasinos(StateAbbreviation.NJ)).rejects.toThrow(
        PerplexityAPIException,
      );
      await expect(client.searchCasinos(StateAbbreviation.NJ)).rejects.toThrow(
        /Network error/,
      );
    });

    it('should handle 401 unauthorized errors', async () => {
      const authError = {
        message: 'Unauthorized',
        isAxiosError: true,
        response: {
          status: 401,
          data: {},
        },
      } as AxiosError;

      mockHttpClient.post.mockRejectedValue(authError);
      mockHttpClient.isAxiosError.mockReturnValue(true);

      await expect(client.searchCasinos(StateAbbreviation.NJ)).rejects.toThrow(
        PerplexityAPIException,
      );
      await expect(client.searchCasinos(StateAbbreviation.NJ)).rejects.toThrow(
        /Invalid API key/,
      );
    });

    it('should handle 429 rate limit errors with retry', async () => {
      const rateLimitError: Partial<AxiosError> = {
        message: 'Too Many Requests',
        isAxiosError: true,
        name: 'AxiosError',
        toJSON: () => ({}),
        response: {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            'retry-after': '60',
          },
          data: {},
          config: mockAxiosConfig,
        },
      };

      mockHttpClient.post.mockRejectedValue(rateLimitError);
      mockHttpClient.isAxiosError.mockReturnValue(true);

      await expect(client.searchCasinos(StateAbbreviation.NJ)).rejects.toThrow(
        PerplexityAPIException,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRateLimiter.handleRateLimitError).toHaveBeenCalledWith(60);
    });

    it('should handle 500 API errors', async () => {
      const apiError = {
        message: 'Internal Server Error',
        isAxiosError: true,
        response: {
          status: 500,
          data: {},
        },
      } as AxiosError;

      mockHttpClient.post.mockRejectedValue(apiError);
      mockHttpClient.isAxiosError.mockReturnValue(true);

      await expect(client.searchCasinos(StateAbbreviation.NJ)).rejects.toThrow(
        PerplexityAPIException,
      );
      await expect(client.searchCasinos(StateAbbreviation.NJ)).rejects.toThrow(
        /API returned/,
      );
    });

    it('should filter out invalid casino data', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-6',
          model: 'llama-3.1-sonar-small-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `[
                  {
                    "name": "Valid Casino",
                    "website": "https://valid.com"
                  },
                  {
                    "website": "https://noname.com"
                  },
                  {
                    "name": null,
                    "website": "https://nullname.com"
                  },
                  "invalid string entry"
                ]`,
              },
              finish_reason: 'stop',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: mockAxiosConfig,
      };

      mockHttpClient.post.mockResolvedValue(mockResponse);

      const result = await client.searchCasinos(StateAbbreviation.NJ);

      expect(result.casinos).toHaveLength(1);
      expect(result.casinos[0].name).toBe('Valid Casino');
    });

    it('should use rate limiter for request execution', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-7',
          model: 'llama-3.1-sonar-small-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: '[]',
              },
              finish_reason: 'stop',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: mockAxiosConfig,
      };

      mockHttpClient.post.mockResolvedValue(mockResponse);

      await client.searchCasinos(StateAbbreviation.NJ);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRateLimiter.execute).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRateLimiter.execute).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
  });
});
