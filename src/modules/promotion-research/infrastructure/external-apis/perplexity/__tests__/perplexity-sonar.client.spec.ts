import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { Casino } from '../../../../../shared/domain/entities/casino.entity';
import { StateAbbreviation } from '../../../../../shared/domain/enums/state.enum';
import { PerplexityAPIException } from '../../../../../shared/domain/exceptions';
import { HttpClient } from '../../../../../shared/infrastructure/external-apis/http-client';
import { RateLimiterService } from '../../../../../shared/infrastructure/rate-limiting';
import { Promotion } from '../../../../domain/entities/promotion.entity';
import { PerplexitySonarClient } from '../perplexity-sonar.client';

describe('PerplexitySonarClient', () => {
  let client: PerplexitySonarClient;
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
        PROMOTION_BATCH_SIZE: 5,
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
        PerplexitySonarClient,
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

    client = module.get<PerplexitySonarClient>(PerplexitySonarClient);

    Object.defineProperty(client, 'httpClient', {
      value: mockHttpClient,
      writable: true,
    });
  });

  describe('queryPromotionsBatch', () => {
    const mockCasinos: Casino[] = [
      Casino.create({
        casinodb_id: 1,
        name: 'BetMGM Casino',
        state: StateAbbreviation.NJ,
        website: 'https://betmgm.com',
      }),
      Casino.create({
        casinodb_id: 2,
        name: 'DraftKings Casino',
        state: StateAbbreviation.NJ,
        website: 'https://draftkings.com',
      }),
    ];

    const mockExistingPromotions = new Map<string, Promotion[]>([
      [
        'BetMGM Casino',
        [
          Promotion.create({
            offerName: 'Old Welcome Bonus',
            offerType: 'welcome_bonus',
            expectedDeposit: 10,
            expectedBonus: 50,
          }),
        ],
      ],
    ]);

    it('should successfully query and parse promotions for batch', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-1',
          model: 'llama-3.1-sonar-large-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `Here are the current promotions:
                
                [
                  {
                    "casinoName": "BetMGM Casino",
                    "offerName": "Welcome Bonus",
                    "offerType": "welcome_bonus",
                    "expectedDeposit": 10,
                    "expectedBonus": 100,
                    "wageringRequirements": "30x bonus",
                    "termsAndConditions": "New players only",
                    "validUntil": "2025-12-31"
                  },
                  {
                    "casinoName": "DraftKings Casino",
                    "offerName": "First Deposit Match",
                    "offerType": "deposit_match",
                    "expectedDeposit": 50,
                    "expectedBonus": 100
                  }
                ]`,
              },
              finish_reason: 'stop',
            },
          ],
          citations: [
            'https://betmgm.com/promotions',
            'https://draftkings.com/promotions',
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: mockAxiosConfig,
      };

      mockHttpClient.post.mockResolvedValue(mockResponse);

      const result = await client.queryPromotionsBatch(
        mockCasinos,
        mockExistingPromotions,
      );

      expect(result.promotions).toHaveLength(2);
      expect(result.promotions[0]).toEqual({
        casinoName: 'BetMGM Casino',
        offerName: 'Welcome Bonus',
        offerType: 'welcome_bonus',
        expectedDeposit: 10,
        expectedBonus: 100,
        wageringRequirements: '30x bonus',
        termsAndConditions: 'New players only',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        validUntil: expect.any(String),
      });
      expect(result.promotions[1]).toEqual({
        casinoName: 'DraftKings Casino',
        offerName: 'First Deposit Match',
        offerType: 'deposit_match',
        expectedDeposit: 50,
        expectedBonus: 100,
        termsAndConditions: undefined,
        wageringRequirements: undefined,
        validUntil: undefined,
      });
      expect(result.citations).toHaveLength(2);
      expect(result.casinos).toEqual(['BetMGM Casino', 'DraftKings Casino']);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRateLimiter.execute).toHaveBeenCalledTimes(1);
    });

    it('should return empty result for empty casino batch', async () => {
      const result = await client.queryPromotionsBatch(
        [],
        mockExistingPromotions,
      );

      expect(result.promotions).toHaveLength(0);
      expect(result.citations).toHaveLength(0);
      expect(result.casinos).toHaveLength(0);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockHttpClient.post).not.toHaveBeenCalled();
    });

    it('should respect configured batch size', async () => {
      const largeCasinoList: Casino[] = Array.from({ length: 10 }, (_, i) =>
        Casino.create({
          casinodb_id: i + 1,
          name: `Casino ${i + 1}`,
          state: StateAbbreviation.NJ,
        }),
      );

      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-2',
          model: 'llama-3.1-sonar-large-128k-online',
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

      const result = await client.queryPromotionsBatch(
        largeCasinoList,
        new Map(),
      );

      expect(result.casinos).toHaveLength(5);
    });

    it('should normalize offer types correctly', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-3',
          model: 'llama-3.1-sonar-large-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `[
                  {
                    "casinoName": "Test Casino",
                    "offerName": "Welcome",
                    "offerType": "welcome",
                    "expectedDeposit": 10,
                    "expectedBonus": 50
                  },
                  {
                    "casinoName": "Test Casino",
                    "offerName": "Match",
                    "offerType": "match bonus",
                    "expectedDeposit": 20,
                    "expectedBonus": 40
                  },
                  {
                    "casinoName": "Test Casino",
                    "offerName": "No Deposit",
                    "offerType": "no deposit",
                    "expectedDeposit": 0,
                    "expectedBonus": 25
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

      const result = await client.queryPromotionsBatch(mockCasinos, new Map());

      expect(result.promotions[0].offerType).toBe('welcome_bonus');
      expect(result.promotions[1].offerType).toBe('deposit_match');
      expect(result.promotions[2].offerType).toBe('no_deposit_bonus');
    });

    it('should handle negative amounts by converting to zero', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-4',
          model: 'llama-3.1-sonar-large-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `[
                  {
                    "casinoName": "Test Casino",
                    "offerName": "Test Offer",
                    "offerType": "welcome_bonus",
                    "expectedDeposit": -10,
                    "expectedBonus": -50
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

      const result = await client.queryPromotionsBatch(mockCasinos, new Map());

      expect(result.promotions[0].expectedDeposit).toBe(0);
      expect(result.promotions[0].expectedBonus).toBe(0);
    });

    it('should filter out invalid promotion data', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-5',
          model: 'llama-3.1-sonar-large-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `[
                  {
                    "casinoName": "Valid Casino",
                    "offerName": "Valid Offer",
                    "offerType": "welcome_bonus",
                    "expectedDeposit": 10,
                    "expectedBonus": 50
                  },
                  {
                    "offerName": "Missing Casino Name",
                    "offerType": "welcome_bonus",
                    "expectedDeposit": 10,
                    "expectedBonus": 50
                  },
                  {
                    "casinoName": "Missing Offer Name",
                    "offerType": "welcome_bonus",
                    "expectedDeposit": 10,
                    "expectedBonus": 50
                  },
                  {
                    "casinoName": "Missing Amounts",
                    "offerName": "Test",
                    "offerType": "welcome_bonus"
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

      const result = await client.queryPromotionsBatch(mockCasinos, new Map());

      expect(result.promotions).toHaveLength(1);
      expect(result.promotions[0].casinoName).toBe('Valid Casino');
    });

    it('should clean casino names and strings properly', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-6',
          model: 'llama-3.1-sonar-large-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `[
                  {
                    "casinoName": "  Casino   Name  ",
                    "offerName": "\\"Quoted   Offer\\"",
                    "offerType": "welcome_bonus",
                    "expectedDeposit": 10,
                    "expectedBonus": 50,
                    "termsAndConditions": "  Multiple   spaces  "
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

      const result = await client.queryPromotionsBatch(mockCasinos, new Map());

      expect(result.promotions[0].casinoName).toBe('Casino Name');
      expect(result.promotions[0].offerName).toBe('Quoted Offer');
      expect(result.promotions[0].termsAndConditions).toBe('Multiple spaces');
    });

    it('should parse valid dates correctly', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-7',
          model: 'llama-3.1-sonar-large-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `[
                  {
                    "casinoName": "Test Casino",
                    "offerName": "Test Offer",
                    "offerType": "welcome_bonus",
                    "expectedDeposit": 10,
                    "expectedBonus": 50,
                    "validUntil": "2025-12-31"
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

      const result = await client.queryPromotionsBatch(mockCasinos, new Map());

      expect(result.promotions[0].validUntil).toBeDefined();
      expect(new Date(result.promotions[0].validUntil!).getFullYear()).toBe(
        2025,
      );
    });

    it('should handle invalid dates gracefully', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-8',
          model: 'llama-3.1-sonar-large-128k-online',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `[
                  {
                    "casinoName": "Test Casino",
                    "offerName": "Test Offer",
                    "offerType": "welcome_bonus",
                    "expectedDeposit": 10,
                    "expectedBonus": 50,
                    "validUntil": "invalid-date"
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

      const result = await client.queryPromotionsBatch(mockCasinos, new Map());

      expect(result.promotions[0].validUntil).toBeUndefined();
    });

    it('should return empty array when no valid JSON found in response', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-9',
          model: 'llama-3.1-sonar-large-128k-online',
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

      const result = await client.queryPromotionsBatch(mockCasinos, new Map());

      expect(result.promotions).toHaveLength(0);
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

      await expect(
        client.queryPromotionsBatch(mockCasinos, new Map()),
      ).rejects.toThrow(PerplexityAPIException);
      await expect(
        client.queryPromotionsBatch(mockCasinos, new Map()),
      ).rejects.toThrow(/Request timeout/);
    });

    it('should handle network errors', async () => {
      const networkError = {
        message: 'Network error',
        isAxiosError: true,
        response: undefined,
      } as AxiosError;

      mockHttpClient.post.mockRejectedValue(networkError);
      mockHttpClient.isAxiosError.mockReturnValue(true);

      await expect(
        client.queryPromotionsBatch(mockCasinos, new Map()),
      ).rejects.toThrow(PerplexityAPIException);
      await expect(
        client.queryPromotionsBatch(mockCasinos, new Map()),
      ).rejects.toThrow(/Network error/);
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
            'retry-after': '120',
          },
          data: {},
          config: mockAxiosConfig,
        },
      };

      mockHttpClient.post.mockRejectedValue(rateLimitError);
      mockHttpClient.isAxiosError.mockReturnValue(true);

      await expect(
        client.queryPromotionsBatch(mockCasinos, new Map()),
      ).rejects.toThrow(PerplexityAPIException);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRateLimiter.handleRateLimitError).toHaveBeenCalledWith(120);
    });

    it('should use rate limiter for request execution', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-10',
          model: 'llama-3.1-sonar-large-128k-online',
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

      await client.queryPromotionsBatch(mockCasinos, new Map());

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRateLimiter.execute).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRateLimiter.execute).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('should use correct API model and parameters', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          id: 'response-11',
          model: 'llama-3.1-sonar-large-128k-online',
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

      await client.queryPromotionsBatch(mockCasinos, new Map());

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/chat/completions',
        expect.objectContaining({
          model: 'llama-3.1-sonar-large-128k-online',
          temperature: 0.2,
          max_tokens: 4000,
          return_citations: true,
          search_recency_filter: 'week',
        }),
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });
  });

  describe('getBatchSize', () => {
    it('should return configured batch size', () => {
      const batchSize = client.getBatchSize();
      expect(batchSize).toBe(5);
    });
  });
});
