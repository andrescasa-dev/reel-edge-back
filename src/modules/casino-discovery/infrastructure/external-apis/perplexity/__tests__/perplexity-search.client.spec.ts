import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Perplexity from '@perplexity-ai/perplexity_ai';
import { StateAbbreviation } from '../../../../../shared/domain/enums/state.enum';
import { PerplexityAPIException } from '../../../../../shared/domain/exceptions';
import { RateLimiterService } from '../../../../../shared/infrastructure/rate-limiting';
import { PerplexitySearchClient } from '../perplexity-search.client';

// Mock the Perplexity SDK
jest.mock('@perplexity-ai/perplexity_ai');

describe('PerplexitySearchClient', () => {
  let client: PerplexitySearchClient;
  let mockPerplexityClient: jest.Mocked<Perplexity>;
  let mockRateLimiter: jest.Mocked<RateLimiterService>;

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

    // Create mock Perplexity client
    mockPerplexityClient = {
      search: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<Perplexity>;

    // Mock the Perplexity constructor
    (Perplexity as jest.MockedClass<typeof Perplexity>).mockImplementation(
      () => mockPerplexityClient,
    );

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
  });

  describe('searchCasinos', () => {
    it('should successfully search and parse casinos from search results', async () => {
      const mockSearchResponse = {
        results: [
          {
            title: 'BetMGM Casino - Official Site',
            url: 'https://casino.betmgm.com',
            snippet:
              'BetMGM Casino offers the best online gaming experience in New Jersey',
            date: '2024-01-15',
            last_updated: '2024-01-20',
          },
          {
            title: 'DraftKings Online Casino',
            url: 'https://casino.draftkings.com',
            snippet: 'Play at DraftKings Casino in NJ',
            date: '2024-01-10',
            last_updated: '2024-01-18',
          },
          {
            title: 'Casino Review Site - Best Bonuses',
            url: 'https://casinoreviews.com/best-bonuses',
            snippet: 'Review of the best casino bonuses',
            date: '2024-01-01',
            last_updated: '2024-01-05',
          },
        ],
        id: 'search-123',
      };

      mockPerplexityClient.search.create.mockResolvedValue(
        mockSearchResponse as any,
      );

      const result = await client.searchCasinos(StateAbbreviation.NJ);

      expect(result.casinos).toHaveLength(2); // Only 2 because review site is excluded
      expect(result.casinos[0].name).toBe('BetMGM');
      expect(result.casinos[0].website).toBe('https://casino.betmgm.com');
      expect(result.casinos[0].state).toBe(StateAbbreviation.NJ);

      expect(result.casinos[1].name).toBe('DraftKings Online');
      expect(result.casinos[1].website).toBe('https://casino.draftkings.com');

      expect(result.searchResults).toHaveLength(3);
      expect(result.searchResults[0].title).toBe('BetMGM Casino - Official Site');
      expect(result.searchResults[0].url).toBe('https://casino.betmgm.com');

      expect(mockPerplexityClient.search.create).toHaveBeenCalledWith({
        query: expect.stringContaining('New Jersey'),
        max_results: 20,
        max_tokens_per_page: 2048,
      });

      expect(mockRateLimiter.execute).toHaveBeenCalledTimes(1);
    });

    it('should filter out duplicate casinos', async () => {
      const mockSearchResponse = {
        results: [
          {
            title: 'BetMGM Casino - Official Site',
            url: 'https://casino.betmgm.com',
            snippet: 'BetMGM Casino offers gaming',
            date: '2024-01-15',
            last_updated: '2024-01-20',
          },
          {
            title: 'BetMGM Casino - Promotions Page',
            url: 'https://casino.betmgm.com/promotions',
            snippet: 'BetMGM Casino promotions',
            date: '2024-01-15',
            last_updated: '2024-01-20',
          },
        ],
        id: 'search-123',
      };

      mockPerplexityClient.search.create.mockResolvedValue(
        mockSearchResponse as any,
      );

      const result = await client.searchCasinos(StateAbbreviation.NJ);

      expect(result.casinos).toHaveLength(1); // Duplicate filtered
      expect(result.casinos[0].name).toBe('BetMGM');
    });

    it('should filter out review and affiliate sites', async () => {
      const mockSearchResponse = {
        results: [
          {
            title: 'Casino Review: Best Sites 2024',
            url: 'https://casinoreviews.com',
            snippet: 'Review of casinos',
            date: '2024-01-01',
            last_updated: '2024-01-05',
          },
          {
            title: 'Affiliate Casino Guide',
            url: 'https://casinoaffiliate.com',
            snippet: 'Affiliate guide',
            date: '2024-01-01',
            last_updated: '2024-01-05',
          },
          {
            title: 'Casino Bonus Comparisons',
            url: 'https://casinobonus.com',
            snippet: 'Compare bonuses',
            date: '2024-01-01',
            last_updated: '2024-01-05',
          },
        ],
        id: 'search-123',
      };

      mockPerplexityClient.search.create.mockResolvedValue(
        mockSearchResponse as any,
      );

      const result = await client.searchCasinos(StateAbbreviation.NJ);

      expect(result.casinos).toHaveLength(0); // All filtered out
      expect(result.searchResults).toHaveLength(3); // But search results preserved
    });

    it('should handle empty search results', async () => {
      const mockSearchResponse = {
        results: [],
        id: 'search-123',
      };

      mockPerplexityClient.search.create.mockResolvedValue(
        mockSearchResponse as any,
      );

      const result = await client.searchCasinos(StateAbbreviation.NJ);

      expect(result.casinos).toHaveLength(0);
      expect(result.searchResults).toHaveLength(0);
    });

    it('should handle results with no valid casino names', async () => {
      const mockSearchResponse = {
        results: [
          {
            title: 'Gambling Commission Website',
            url: 'https://nj.gov/gaming',
            snippet: 'Official NJ gaming commission',
            date: '2024-01-01',
            last_updated: '2024-01-05',
          },
        ],
        id: 'search-123',
      };

      mockPerplexityClient.search.create.mockResolvedValue(
        mockSearchResponse as any,
      );

      const result = await client.searchCasinos(StateAbbreviation.NJ);

      expect(result.casinos).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limit errors', async () => {
      const rateLimitError = new Perplexity.RateLimitError('Rate limit exceeded');
      mockPerplexityClient.search.create.mockRejectedValue(rateLimitError);

      await expect(
        client.searchCasinos(StateAbbreviation.NJ),
      ).rejects.toThrow(PerplexityAPIException);

      expect(mockRateLimiter.handleRateLimitError).toHaveBeenCalledWith(60);
    });

    it('should handle bad request errors', async () => {
      const badRequestError = new Perplexity.BadRequestError('Invalid query');
      mockPerplexityClient.search.create.mockRejectedValue(badRequestError);

      await expect(
        client.searchCasinos(StateAbbreviation.NJ),
      ).rejects.toThrow(PerplexityAPIException);
    });

    it('should handle API errors', async () => {
      const apiError = new Perplexity.APIError(
        500,
        {} as any,
        'Internal server error',
        {},
      );
      mockPerplexityClient.search.create.mockRejectedValue(apiError);

      await expect(
        client.searchCasinos(StateAbbreviation.NJ),
      ).rejects.toThrow(PerplexityAPIException);
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Network error');
      mockPerplexityClient.search.create.mockRejectedValue(genericError);

      await expect(
        client.searchCasinos(StateAbbreviation.NJ),
      ).rejects.toThrow(PerplexityAPIException);
    });
  });

  describe('Configuration', () => {
    it('should throw error if API key is not configured', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            PerplexitySearchClient,
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
  });

  describe('Multiple States', () => {
    it.each([
      [StateAbbreviation.NJ, 'New Jersey'],
      [StateAbbreviation.MI, 'Michigan'],
      [StateAbbreviation.PA, 'Pennsylvania'],
      [StateAbbreviation.WV, 'West Virginia'],
    ])(
      'should create correct search query for %s (%s)',
      async (state, stateName) => {
        const mockSearchResponse = {
          results: [],
          id: 'search-123',
        };

        mockPerplexityClient.search.create.mockResolvedValue(
          mockSearchResponse as any,
        );

        await client.searchCasinos(state);

        expect(mockPerplexityClient.search.create).toHaveBeenCalledWith({
          query: expect.stringContaining(stateName),
          max_results: 20,
          max_tokens_per_page: 2048,
        });
      },
    );
  });

  describe('URL Cleaning', () => {
    it('should normalize URLs correctly', async () => {
      const mockSearchResponse = {
        results: [
          {
            title: 'BetMGM Casino',
            url: 'HTTPS://CASINO.BETMGM.COM/PATH',
            snippet: 'BetMGM Casino',
            date: '2024-01-15',
            last_updated: '2024-01-20',
          },
        ],
        id: 'search-123',
      };

      mockPerplexityClient.search.create.mockResolvedValue(
        mockSearchResponse as any,
      );

      const result = await client.searchCasinos(StateAbbreviation.NJ);

      expect(result.casinos[0].website).toBe(
        'https://casino.betmgm.com/path',
      );
    });
  });
});
