import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma/prisma.service';
import { CasinoRepository } from '../../../../shared/infrastructure/repositories/casino.repository';
import { StateAbbreviation } from '../../../../shared/domain/enums/state.enum';
import { Casino } from '../../../../shared/domain/entities/casino.entity';
import { ReelEdgeData } from '../../../../shared/infrastructure/external-apis/reel-edge/reel-edge.client';
import { PerplexitySearchClient } from '../../../infrastructure/external-apis/perplexity/perplexity-search.client';
import { DiscoveredCasino } from '../../../infrastructure/external-apis/perplexity/perplexity-search.types';
import { MissingCasinoRepository } from '../../../infrastructure/repositories/missing-casino.repository';
import { CasinoDiscoveryService } from '../casino-discovery.service';
import { cleanDatabase } from '../../../../../../test/helpers/database-cleanup.helper';
import { PerplexityAPIException } from '../../../../shared/domain/exceptions';

describe('CasinoDiscoveryService', () => {
  let service: CasinoDiscoveryService;
  let perplexitySearchClient: jest.Mocked<PerplexitySearchClient>;
  let missingCasinoRepository: MissingCasinoRepository;
  let prismaService: PrismaService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL_TEST && process.env.NODE_ENV === 'test') {
      throw new Error(
        'DATABASE_URL_TEST must be set for tests to avoid running against development database',
      );
    }

    const mockPerplexitySearchClient = {
      searchCasinos: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasinoDiscoveryService,
        {
          provide: PerplexitySearchClient,
          useValue: mockPerplexitySearchClient,
        },
        MissingCasinoRepository,
        CasinoRepository,
        PrismaService,
      ],
    }).compile();

    service = module.get<CasinoDiscoveryService>(CasinoDiscoveryService);
    perplexitySearchClient = module.get(PerplexitySearchClient);
    missingCasinoRepository = module.get<MissingCasinoRepository>(
      MissingCasinoRepository,
    );
    prismaService = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prismaService);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prismaService.$disconnect();
  });

  describe('compareCasinoLists', () => {
    it('should identify missing casinos when no matches found', () => {
      const discovered: DiscoveredCasino[] = [
        {
          name: 'New Casino A',
          state: StateAbbreviation.NJ,
          website: 'https://newcasinoa.com',
        },
        {
          name: 'New Casino B',
          state: StateAbbreviation.NJ,
        },
      ];

      const existing: Casino[] = [
        Casino.create({
          casinodb_id: 1,
          name: 'Existing Casino',
          state: StateAbbreviation.NJ,
        }),
      ];

      const missing = service.compareCasinoLists(discovered, existing);

      expect(missing).toHaveLength(2);
      expect(missing[0].name).toBe('New Casino A');
      expect(missing[1].name).toBe('New Casino B');
    });

    it('should not include casinos that match existing ones (exact match)', () => {
      const discovered: DiscoveredCasino[] = [
        {
          name: 'Existing Casino',
          state: StateAbbreviation.NJ,
        },
        {
          name: 'New Casino',
          state: StateAbbreviation.NJ,
        },
      ];

      const existing: Casino[] = [
        Casino.create({
          casinodb_id: 1,
          name: 'Existing Casino',
          state: StateAbbreviation.NJ,
        }),
      ];

      const missing = service.compareCasinoLists(discovered, existing);

      expect(missing).toHaveLength(1);
      expect(missing[0].name).toBe('New Casino');
    });

    it('should handle fuzzy matching for name variations', () => {
      const discovered: DiscoveredCasino[] = [
        {
          name: 'Caesars Palace Casino',
          state: StateAbbreviation.NJ,
        },
        {
          name: 'MGM Resorts Casino',
          state: StateAbbreviation.NJ,
        },
        {
          name: 'Completely New Casino',
          state: StateAbbreviation.NJ,
        },
      ];

      const existing: Casino[] = [
        Casino.create({
          casinodb_id: 1,
          name: 'Caesars',
          state: StateAbbreviation.NJ,
        }),
        Casino.create({
          casinodb_id: 2,
          name: 'MGM',
          state: StateAbbreviation.NJ,
        }),
      ];

      const missing = service.compareCasinoLists(discovered, existing);

      expect(missing).toHaveLength(1);
      expect(missing[0].name).toBe('Completely New Casino');
    });

    it('should handle case-insensitive matching', () => {
      const discovered: DiscoveredCasino[] = [
        {
          name: 'EXISTING CASINO',
          state: StateAbbreviation.NJ,
        },
        {
          name: 'new casino',
          state: StateAbbreviation.NJ,
        },
      ];

      const existing: Casino[] = [
        Casino.create({
          casinodb_id: 1,
          name: 'Existing Casino',
          state: StateAbbreviation.NJ,
        }),
      ];

      const missing = service.compareCasinoLists(discovered, existing);

      expect(missing).toHaveLength(1);
      expect(missing[0].name).toBe('new casino');
    });

    it('should handle similar names with high similarity threshold', () => {
      const discovered: DiscoveredCasino[] = [
        {
          name: 'Casino Royale',
          state: StateAbbreviation.NJ,
        },
        {
          name: 'Casino Royalee',
          state: StateAbbreviation.NJ,
        },
        {
          name: 'Different Casino',
          state: StateAbbreviation.NJ,
        },
      ];

      const existing: Casino[] = [
        Casino.create({
          casinodb_id: 1,
          name: 'Casino Royale',
          state: StateAbbreviation.NJ,
        }),
      ];

      const missing = service.compareCasinoLists(discovered, existing);

      expect(missing.length).toBeLessThanOrEqual(2);
      expect(missing.some((c) => c.name === 'Different Casino')).toBe(true);
    });
  });

  describe('discoverCasinosForState', () => {
    it('should discover missing casinos and store them in database', async () => {
      const cachedReelEdgeData: ReelEdgeData = {
        casinos: [
          Casino.create({
            casinodb_id: 1,
            name: 'Existing Casino',
            state: StateAbbreviation.NJ,
          }),
        ],
        promotions: new Map(),
      };

      const mockSearchResult = {
        casinos: [
          {
            name: 'New Casino A',
            state: StateAbbreviation.NJ,
            website: 'https://newcasinoa.com',
          },
          {
            name: 'Existing Casino',
            state: StateAbbreviation.NJ,
          },
        ] as DiscoveredCasino[],
        searchResults: [
          {
            title: 'New Casino A - Official Site',
            url: 'https://newcasinoa.com',
            snippet: 'New Casino A is a licensed online casino in New Jersey',
          },
        ],
      };

      perplexitySearchClient.searchCasinos.mockResolvedValue(mockSearchResult);

      const result = await service.discoverCasinosForState(
        StateAbbreviation.NJ,
        cachedReelEdgeData,
      );

      expect(result.discovered).toBe(2);
      expect(result.missing).toBe(1);
      expect(result.missingCasinos).toHaveLength(1);
      expect(result.missingCasinos[0].name).toBe('New Casino A');

      const stored = await missingCasinoRepository.findByState(
        StateAbbreviation.NJ,
      );
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('New Casino A');
    });

    it('should not store duplicate missing casinos', async () => {
      const cachedReelEdgeData: ReelEdgeData = {
        casinos: [],
        promotions: new Map(),
      };

      await missingCasinoRepository.create({
        name: 'Already Missing Casino',
        state: StateAbbreviation.NJ,
        source: 'Previous Discovery',
        promotionsFound: 0,
      });

      const mockSearchResult = {
        casinos: [
          {
            name: 'Already Missing Casino',
            state: StateAbbreviation.NJ,
          },
          {
            name: 'New Missing Casino',
            state: StateAbbreviation.NJ,
          },
        ] as DiscoveredCasino[],
        searchResults: [
          {
            title: 'New Missing Casino',
            url: 'https://newmissing.com',
            snippet: 'New Missing Casino',
          },
        ],
      };

      perplexitySearchClient.searchCasinos.mockResolvedValue(mockSearchResult);

      const result = await service.discoverCasinosForState(
        StateAbbreviation.NJ,
        cachedReelEdgeData,
      );

      expect(result.discovered).toBe(2);
      expect(result.missing).toBe(1);
      expect(result.missingCasinos[0].name).toBe('New Missing Casino');

      const stored = await missingCasinoRepository.findByState(
        StateAbbreviation.NJ,
      );
      expect(stored).toHaveLength(2);
    });

    it('should filter casinos by state from cached data', async () => {
      const cachedReelEdgeData: ReelEdgeData = {
        casinos: [
          Casino.create({
            casinodb_id: 1,
            name: 'Existing NJ Casino',
            state: StateAbbreviation.NJ,
          }),
          Casino.create({
            casinodb_id: 2,
            name: 'MI Casino',
            state: StateAbbreviation.MI,
          }),
        ],
        promotions: new Map(),
      };

      const mockSearchResult = {
        casinos: [
          {
            name: 'Completely New NJ Casino',
            state: StateAbbreviation.NJ,
          },
        ] as DiscoveredCasino[],
        searchResults: [
          {
            title: 'Completely New NJ Casino',
            url: 'https://completelynew.com',
            snippet: 'Completely New NJ Casino',
          },
        ],
      };

      perplexitySearchClient.searchCasinos.mockResolvedValue(mockSearchResult);

      const result = await service.discoverCasinosForState(
        StateAbbreviation.NJ,
        cachedReelEdgeData,
      );

      expect(result.discovered).toBe(1);
      expect(result.missing).toBe(1);
    });

    it('should handle Perplexity API errors gracefully', async () => {
      const cachedReelEdgeData: ReelEdgeData = {
        casinos: [],
        promotions: new Map(),
      };

      perplexitySearchClient.searchCasinos.mockRejectedValue(
        PerplexityAPIException.networkError(new Error('Network error')),
      );

      await expect(
        service.discoverCasinosForState(
          StateAbbreviation.NJ,
          cachedReelEdgeData,
        ),
      ).rejects.toThrow(PerplexityAPIException);
    });
  });

  describe('getMissingCasinos', () => {
    beforeEach(async () => {
      await missingCasinoRepository.create({
        name: 'NJ Missing Casino 1',
        state: StateAbbreviation.NJ,
        source: 'Source 1',
        promotionsFound: 0,
      });
      await missingCasinoRepository.create({
        name: 'NJ Missing Casino 2',
        state: StateAbbreviation.NJ,
        source: 'Source 2',
        promotionsFound: 0,
      });
      await missingCasinoRepository.create({
        name: 'PA Missing Casino',
        state: StateAbbreviation.PA,
        source: 'Source 3',
        promotionsFound: 0,
      });
    });

    it('should return all missing casinos without filters', async () => {
      const result = await service.getMissingCasinos();

      expect(result.casinos).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by state', async () => {
      const result = await service.getMissingCasinos({
        state: StateAbbreviation.NJ,
      });

      expect(result.casinos).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(
        result.casinos.every((c) => c.state === StateAbbreviation.NJ),
      ).toBe(true);
    });

    it('should filter by search term', async () => {
      const result = await service.getMissingCasinos({
        search: 'Casino 1',
      });

      expect(result.casinos).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.casinos[0].name).toBe('NJ Missing Casino 1');
    });

    it('should support pagination', async () => {
      const result1 = await service.getMissingCasinos({
        limit: 2,
        offset: 0,
      });

      expect(result1.casinos).toHaveLength(2);
      expect(result1.total).toBe(3);

      const result2 = await service.getMissingCasinos({
        limit: 2,
        offset: 2,
      });

      expect(result2.casinos).toHaveLength(1);
      expect(result2.total).toBe(3);
    });

    it('should combine state and search filters', async () => {
      const result = await service.getMissingCasinos({
        state: StateAbbreviation.NJ,
        search: 'Casino 2',
      });

      expect(result.casinos).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.casinos[0].name).toBe('NJ Missing Casino 2');
    });
  });

  describe('enrichCasinoMetadata', () => {
    it('should return casino as-is if already has complete metadata', async () => {
      const casino: DiscoveredCasino = {
        name: 'Complete Casino',
        state: StateAbbreviation.NJ,
        website: 'https://complete.com',
        regulatoryId: 'REG-123',
      };

      const result = await service.enrichCasinoMetadata(casino);

      expect(result).toEqual(casino);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(perplexitySearchClient.searchCasinos).not.toHaveBeenCalled();
    });

    it('should enrich casino with missing metadata from Perplexity', async () => {
      const casino: DiscoveredCasino = {
        name: 'Incomplete Casino',
        state: StateAbbreviation.NJ,
      };

      const mockSearchResult = {
        casinos: [
          {
            name: 'Incomplete Casino',
            state: StateAbbreviation.NJ,
            website: 'https://incomplete.com',
            regulatoryId: 'REG-456',
          },
        ] as DiscoveredCasino[],
        searchResults: [],
      };

      perplexitySearchClient.searchCasinos.mockResolvedValue(mockSearchResult);

      const result = await service.enrichCasinoMetadata(casino);

      expect(result.website).toBe('https://incomplete.com');
      expect(result.regulatoryId).toBe('REG-456');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(perplexitySearchClient.searchCasinos).toHaveBeenCalledWith(
        StateAbbreviation.NJ,
      );
    });

    it('should preserve existing metadata when enriching', async () => {
      const casino: DiscoveredCasino = {
        name: 'Partial Casino',
        state: StateAbbreviation.NJ,
        website: 'https://existing.com',
      };

      const mockSearchResult = {
        casinos: [
          {
            name: 'Partial Casino',
            state: StateAbbreviation.NJ,
            website: 'https://new.com',
            regulatoryId: 'REG-789',
          },
        ] as DiscoveredCasino[],
        searchResults: [],
      };

      perplexitySearchClient.searchCasinos.mockResolvedValue(mockSearchResult);

      const result = await service.enrichCasinoMetadata(casino);

      expect(result.website).toBe('https://existing.com');
      expect(result.regulatoryId).toBe('REG-789');
    });

    it('should handle errors during enrichment gracefully', async () => {
      const casino: DiscoveredCasino = {
        name: 'Error Casino',
        state: StateAbbreviation.NJ,
      };

      perplexitySearchClient.searchCasinos.mockRejectedValue(
        new Error('Enrichment error'),
      );

      const result = await service.enrichCasinoMetadata(casino);

      expect(result).toEqual(casino);
    });
  });
});
