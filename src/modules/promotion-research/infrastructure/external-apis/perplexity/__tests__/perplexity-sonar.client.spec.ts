import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Perplexity from '@perplexity-ai/perplexity_ai';
import { Casino } from '../../../../../shared/domain/entities/casino.entity';
import { StateAbbreviation } from '../../../../../shared/domain/enums/state.enum';
import { PerplexityAPIException } from '../../../../../shared/domain/exceptions';
import { RateLimiterService } from '../../../../../shared/infrastructure/rate-limiting';
import { Promotion } from '../../../../domain/entities/promotion.entity';
import { PerplexitySonarClient } from '../perplexity-sonar.client';

// Mock the Perplexity SDK
jest.mock('@perplexity-ai/perplexity_ai');

// Define mock types
interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  search_recency_filter?: string;
  return_images?: boolean;
  return_related_questions?: boolean;
  response_format?: {
    type: string;
    json_schema?: {
      schema: unknown;
    };
  };
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  search_results?: Array<{ url: string }>;
}

interface MockPerplexityClient {
  chat: {
    completions: {
      create: jest.Mock<
        Promise<ChatCompletionResponse>,
        [ChatCompletionRequest]
      >;
    };
  };
}

describe('PerplexitySonarClient', () => {
  let client: PerplexitySonarClient;
  let mockPerplexityClient: MockPerplexityClient;
  let mockRateLimiter: jest.Mocked<RateLimiterService>;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'PERPLEXITY_API_KEY') return 'test-api-key';
      if (key === 'PROMOTION_BATCH_SIZE') return 5;
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create simple mock
    mockPerplexityClient = {
      chat: {
        completions: {
          create: jest.fn<
            Promise<ChatCompletionResponse>,
            [ChatCompletionRequest]
          >(),
        },
      },
    };

    // Mock the constructor
    (Perplexity as jest.MockedClass<typeof Perplexity>).mockImplementation(
      () => mockPerplexityClient as unknown as Perplexity,
    );

    mockRateLimiter = {
      execute: jest.fn().mockImplementation((fn: () => unknown) => fn()),
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
  });

  describe('queryPromotionsBatch - Basic Functionality', () => {
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

    it('should successfully query promotions', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  casinoName: 'BetMGM Casino',
                  offerName: '$1000 Welcome Bonus',
                  offerType: 'welcome_bonus',
                  expectedDeposit: 10,
                  expectedBonus: 1000,
                  wageringRequirements: '15x',
                  termsAndConditions: 'T&Cs apply',
                },
              ]),
            },
          },
        ],
        search_results: [{ url: 'https://betmgm.com/promotions' }],
      };

      mockPerplexityClient.chat.completions.create.mockResolvedValue(
        mockResponse,
      );

      const result = await client.queryPromotionsBatch(mockCasinos, new Map());

      expect(result.promotions).toHaveLength(1);
      expect(result.promotions[0].casinoName).toBe('BetMGM Casino');
      expect(result.promotions[0].offerName).toBe('$1000 Welcome Bonus');
      expect(result.promotions[0].expectedBonus).toBe(1000);
      expect(result.citations).toHaveLength(1);
      expect(result.casinos).toHaveLength(2);
    });

    it('should handle empty casino batch', async () => {
      const result = await client.queryPromotionsBatch([], new Map());

      expect(result.promotions).toHaveLength(0);
      expect(result.citations).toHaveLength(0);
      expect(result.casinos).toHaveLength(0);
    });

    it('should handle no promotions found', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify([]),
            },
          },
        ],
        search_results: [],
      };

      mockPerplexityClient.chat.completions.create.mockResolvedValue(
        mockResponse,
      );

      const result = await client.queryPromotionsBatch(mockCasinos, new Map());

      expect(result.promotions).toHaveLength(0);
    });

    it('should filter out invalid promotion data', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  casinoName: 'BetMGM Casino',
                  offerName: 'Valid Offer',
                  offerType: 'welcome_bonus',
                  expectedDeposit: 10,
                  expectedBonus: 1000,
                },
                {
                  // Missing required fields
                  casinoName: 'Invalid Casino',
                },
              ]),
            },
          },
        ],
        search_results: [],
      };

      mockPerplexityClient.chat.completions.create.mockResolvedValue(
        mockResponse,
      );

      const result = await client.queryPromotionsBatch(mockCasinos, new Map());

      expect(result.promotions).toHaveLength(1);
      expect(result.promotions[0].casinoName).toBe('BetMGM Casino');
    });

    it('should use rate limiter', async () => {
      const mockResponse = {
        choices: [{ message: { content: JSON.stringify([]) } }],
        search_results: [],
      };

      mockPerplexityClient.chat.completions.create.mockResolvedValue(
        mockResponse,
      );

      await client.queryPromotionsBatch(mockCasinos, new Map());

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRateLimiter.execute).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRateLimiter.execute).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
  });

  describe('Error Handling', () => {
    const mockCasinos: Casino[] = [
      Casino.create({
        casinodb_id: 1,
        name: 'Test Casino',
        state: StateAbbreviation.NJ,
      }),
    ];

    it('should handle rate limit errors', async () => {
      // Create a mock RateLimitError that matches the expected structure
      const rateLimitError = Object.create(
        Perplexity.RateLimitError.prototype,
      ) as Error & { name: string };
      Object.assign(rateLimitError, {
        message: 'Rate limit exceeded',
        name: 'RateLimitError',
      });
      mockPerplexityClient.chat.completions.create.mockRejectedValue(
        rateLimitError,
      );

      await expect(
        client.queryPromotionsBatch(mockCasinos, new Map()),
      ).rejects.toThrow(PerplexityAPIException);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRateLimiter.handleRateLimitError).toHaveBeenCalledWith(60);
    });

    it('should handle bad request errors', async () => {
      // Create a mock BadRequestError that matches the expected structure
      const badRequestError = Object.create(
        Perplexity.BadRequestError.prototype,
      ) as Error & { name: string };
      Object.assign(badRequestError, {
        message: 'Invalid request',
        name: 'BadRequestError',
      });
      mockPerplexityClient.chat.completions.create.mockRejectedValue(
        badRequestError,
      );

      await expect(
        client.queryPromotionsBatch(mockCasinos, new Map()),
      ).rejects.toThrow(PerplexityAPIException);
    });

    it('should handle API errors', async () => {
      // Create a mock APIError that matches the expected structure
      const apiError = Object.create(Perplexity.APIError.prototype) as Error & {
        status: number;
        name: string;
      };
      Object.assign(apiError, {
        status: 500,
        message: 'Internal server error',
        name: 'APIError',
      });
      mockPerplexityClient.chat.completions.create.mockRejectedValue(apiError);

      await expect(
        client.queryPromotionsBatch(mockCasinos, new Map()),
      ).rejects.toThrow(PerplexityAPIException);
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Network error');
      mockPerplexityClient.chat.completions.create.mockRejectedValue(
        genericError,
      );

      await expect(
        client.queryPromotionsBatch(mockCasinos, new Map()),
      ).rejects.toThrow(PerplexityAPIException);
    });
  });

  describe('Configuration', () => {
    it('should throw error if API key is not configured', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            PerplexitySonarClient,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn().mockReturnValue(''),
              },
            },
            {
              provide: RateLimiterService,
              useValue: mockRateLimiter,
            },
          ],
        }).compile(),
      ).rejects.toThrow('Perplexity API key is required');
    });

    it('should return configured batch size', () => {
      const batchSize = client.getBatchSize();
      expect(batchSize).toBe(5);
    });

    it('should use default batch size if not configured', async () => {
      const moduleWithDefaults: TestingModule = await Test.createTestingModule({
        providers: [
          PerplexitySonarClient,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'PERPLEXITY_API_KEY') return 'test-key';
                return undefined;
              }),
            },
          },
          {
            provide: RateLimiterService,
            useValue: mockRateLimiter,
          },
        ],
      }).compile();

      const clientWithDefaults = moduleWithDefaults.get<PerplexitySonarClient>(
        PerplexitySonarClient,
      );

      expect(clientWithDefaults.getBatchSize()).toBe(7);
    });
  });

  describe('API Integration', () => {
    const mockCasinos: Casino[] = [
      Casino.create({
        casinodb_id: 1,
        name: 'Test Casino',
        state: StateAbbreviation.NJ,
      }),
    ];

    it('should use sonar model', async () => {
      const mockResponse = {
        choices: [{ message: { content: JSON.stringify([]) } }],
        search_results: [],
      };

      mockPerplexityClient.chat.completions.create.mockResolvedValue(
        mockResponse,
      );

      await client.queryPromotionsBatch(mockCasinos, new Map());

      expect(mockPerplexityClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'sonar',
          temperature: 0.2,
          max_tokens: 2000,
          search_recency_filter: 'week',
        }),
      );
    });

    it('should include structured output format', async () => {
      const mockResponse = {
        choices: [{ message: { content: JSON.stringify([]) } }],
        search_results: [],
      };

      mockPerplexityClient.chat.completions.create.mockResolvedValue(
        mockResponse,
      );

      await client.queryPromotionsBatch(mockCasinos, new Map());

      const mockCalls: Array<[ChatCompletionRequest]> =
        mockPerplexityClient.chat.completions.create.mock.calls;
      const firstCall = mockCalls[0];
      const callArgs = firstCall?.[0];

      expect(callArgs?.response_format).toBeDefined();
      expect(callArgs?.response_format?.type).toBe('json_schema');
    });

    it('should include existing promotions in context', async () => {
      const existingPromotions = new Map<string, Promotion[]>([
        [
          'Test Casino',
          [
            Promotion.create({
              offerName: 'Old Bonus',
              offerType: 'welcome_bonus',
              expectedDeposit: 10,
              expectedBonus: 50,
            }),
          ],
        ],
      ]);

      const mockResponse = {
        choices: [{ message: { content: JSON.stringify([]) } }],
        search_results: [],
      };

      mockPerplexityClient.chat.completions.create.mockResolvedValue(
        mockResponse,
      );

      await client.queryPromotionsBatch(mockCasinos, existingPromotions);

      const mockCalls: Array<[ChatCompletionRequest]> =
        mockPerplexityClient.chat.completions.create.mock.calls;
      const firstCall = mockCalls[0];
      const callArgs = firstCall?.[0];
      const userMessage = callArgs?.messages?.find((m) => m.role === 'user');

      expect(userMessage?.content).toContain('Old Bonus');
      expect(userMessage?.content).toContain('Current known promotions');
    });
  });
});
