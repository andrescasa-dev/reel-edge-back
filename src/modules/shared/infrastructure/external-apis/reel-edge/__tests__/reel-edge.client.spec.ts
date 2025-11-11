import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosResponse } from 'axios';
import { StateAbbreviation } from '../../../../domain/enums/state.enum';
import { ReelEdgeAPIException } from '../../../../domain/exceptions/reel-edge-api.exception';
import { HttpClient } from '../../http-client';
import { ReelEdgeDBClient } from '../reel-edge.client';

describe('ReelEdgeDBClient', () => {
  let client: ReelEdgeDBClient;
  let mockHttpClient: jest.Mocked<HttpClient>;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'reelEdge.apiUrl': 'https://test-api.com',
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReelEdgeDBClient,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    client = module.get<ReelEdgeDBClient>(ReelEdgeDBClient);

    // Replace httpClient with mock for testing
    Object.defineProperty(client, 'httpClient', {
      value: mockHttpClient,
      writable: true,
    });
  });

  describe('fetchAllActiveData', () => {
    it('should successfully fetch and transform data', async () => {
      const mockResponse = {
        data: [
          {
            casinodb_id: 101,
            Name: 'Casino A',
            states_id: 2,
            state: {
              Name: 'New Jersey',
              Abbreviation: 'NJ',
            },
            website: 'https://casinoa.com',
            Regulatory_Id: 'REG-A',
            Offer_Name: 'Welcome Bonus',
            offer_type: 'Deposit Bonus',
            Expected_Deposit: 100,
            Expected_Bonus: 200,
            Terms_And_Conditions: 'Terms apply',
            Wagering_Requirements: '30x',
            Valid_From: '2024-01-01',
            Valid_Until: '2024-12-31',
          },
          {
            casinodb_id: 101,
            Name: 'Casino A',
            states_id: 2,
            state: {
              Name: 'New Jersey',
              Abbreviation: 'NJ',
            },
            website: 'https://casinoa.com',
            Regulatory_Id: 'REG-A',
            Offer_Name: 'No Deposit Bonus',
            offer_type: 'No Deposit',
            Expected_Deposit: 0,
            Expected_Bonus: 50,
          },
          {
            casinodb_id: 102,
            Name: 'Casino B',
            states_id: 3,
            state: {
              Name: 'Michigan',
              Abbreviation: 'MI',
            },
            website: 'https://casinob.com',
          },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClient.get.mockResolvedValueOnce(mockResponse as AxiosResponse);

      const result = await client.fetchAllActiveData();

      expect(result.casinos).toHaveLength(2);
      expect(result.casinos[0].name).toBe('Casino A');
      expect(result.casinos[0].state).toBe(StateAbbreviation.NJ);
      expect(result.casinos[1].name).toBe('Casino B');
      expect(result.casinos[1].state).toBe(StateAbbreviation.MI);

      expect(result.promotions.size).toBe(1);
      expect(result.promotions.get(101)).toHaveLength(2);

      const promotions = result.promotions.get(101)!;
      expect(promotions[0].offerName).toBe('Welcome Bonus');
      expect(promotions[0].expectedBonus).toBe(200);
      expect(promotions[1].offerName).toBe('No Deposit Bonus');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockHttpClient.get).toHaveBeenCalledWith('/activeSUB');
    });

    it('should handle empty response data', async () => {
      const mockResponse = {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClient.get.mockResolvedValueOnce(mockResponse as AxiosResponse);

      const result = await client.fetchAllActiveData();

      expect(result.casinos).toHaveLength(0);
      expect(result.promotions.size).toBe(0);
    });

    it('should skip records with invalid state', async () => {
      const mockResponse = {
        data: [
          {
            casinodb_id: 101,
            Name: 'Invalid Casino',
            states_id: 99,
            state: {
              Name: 'Invalid State',
              Abbreviation: 'INVALID',
            },
          },
          {
            casinodb_id: 102,
            Name: 'Valid Casino',
            states_id: 2,
            state: {
              Name: 'New Jersey',
              Abbreviation: 'NJ',
            },
          },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClient.get.mockResolvedValueOnce(mockResponse as AxiosResponse);

      const result = await client.fetchAllActiveData();

      expect(result.casinos).toHaveLength(1);
      expect(result.casinos[0].name).toBe('Valid Casino');
    });

    it('should handle records with missing promotion fields', async () => {
      const mockResponse = {
        data: [
          {
            casinodb_id: 101,
            Name: 'Casino A',
            states_id: 2,
            state: {
              Name: 'New Jersey',
              Abbreviation: 'NJ',
            },
            Offer_Name: 'Incomplete Offer',
          },
          {
            casinodb_id: 101,
            Name: 'Casino A',
            states_id: 2,
            state: {
              Name: 'New Jersey',
              Abbreviation: 'NJ',
            },
            Offer_Name: 'Complete Offer',
            offer_type: 'Deposit Bonus',
            Expected_Deposit: 100,
            Expected_Bonus: 200,
          },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClient.get.mockResolvedValueOnce(mockResponse as AxiosResponse);

      const result = await client.fetchAllActiveData();

      expect(result.casinos).toHaveLength(1);
      expect(result.promotions.get(101)).toHaveLength(1);
      expect(result.promotions.get(101)![0].offerName).toBe('Complete Offer');
    });
  });

  describe('error handling', () => {
    it('should throw ReelEdgeAPIException for timeout errors', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
        isAxiosError: true,
        config: {},
        toJSON: () => ({}),
      } as AxiosError;

      mockHttpClient.get.mockRejectedValueOnce(timeoutError);
      mockHttpClient.isAxiosError.mockReturnValue(true);

      await expect(client.fetchAllActiveData()).rejects.toThrow(
        ReelEdgeAPIException,
      );
    });

    it('should throw ReelEdgeAPIException for network errors', async () => {
      const networkError = {
        message: 'Network Error',
        isAxiosError: true,
        config: {},
        toJSON: () => ({}),
      } as AxiosError;

      mockHttpClient.get.mockRejectedValueOnce(networkError);
      mockHttpClient.isAxiosError.mockReturnValue(true);

      await expect(client.fetchAllActiveData()).rejects.toThrow(
        ReelEdgeAPIException,
      );
    });

    it('should throw ReelEdgeAPIException for API errors', async () => {
      const apiError = {
        message: 'Request failed with status code 500',
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: 'Internal Server Error' },
          statusText: 'Internal Server Error',
          headers: {},
          config: {},
        },
        config: {},
        toJSON: () => ({}),
      } as AxiosError;

      mockHttpClient.get.mockRejectedValueOnce(apiError);
      mockHttpClient.isAxiosError.mockReturnValue(true);

      await expect(client.fetchAllActiveData()).rejects.toThrow(
        ReelEdgeAPIException,
      );
    });

    it('should throw ReelEdgeAPIException for empty response', async () => {
      const mockResponse = {
        data: null,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClient.get.mockResolvedValueOnce(mockResponse as AxiosResponse);

      await expect(client.fetchAllActiveData()).rejects.toThrow(
        ReelEdgeAPIException,
      );
    });
  });

  // Note: Retry logic is handled by HttpClient and tested in http-client.spec.ts

  describe('data transformation', () => {
    it('should correctly parse date fields', async () => {
      const mockResponse = {
        data: [
          {
            casinodb_id: 101,
            Name: 'Casino A',
            states_id: 2,
            state: {
              Name: 'New Jersey',
              Abbreviation: 'NJ',
            },
            Offer_Name: 'Welcome Bonus',
            offer_type: 'Deposit Bonus',
            Expected_Deposit: 100,
            Expected_Bonus: 200,
            Valid_From: '2024-06-15T12:00:00.000Z',
            Valid_Until: '2024-12-15T12:00:00.000Z',
          },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClient.get.mockResolvedValueOnce(mockResponse as AxiosResponse);

      const result = await client.fetchAllActiveData();

      const promotions = result.promotions.get(101)!;
      expect(promotions[0].validFrom).toBeInstanceOf(Date);
      expect(promotions[0].validUntil).toBeInstanceOf(Date);
      expect(promotions[0].validFrom?.getFullYear()).toBe(2024);
    });

    it('should group multiple promotions by casino', async () => {
      const mockResponse = {
        data: [
          {
            casinodb_id: 101,
            Name: 'Casino A',
            states_id: 2,
            state: {
              Name: 'New Jersey',
              Abbreviation: 'NJ',
            },
            Offer_Name: 'Bonus 1',
            offer_type: 'Deposit Bonus',
            Expected_Deposit: 100,
            Expected_Bonus: 200,
          },
          {
            casinodb_id: 101,
            Name: 'Casino A',
            states_id: 2,
            state: {
              Name: 'New Jersey',
              Abbreviation: 'NJ',
            },
            Offer_Name: 'Bonus 2',
            offer_type: 'No Deposit',
            Expected_Deposit: 0,
            Expected_Bonus: 50,
          },
          {
            casinodb_id: 102,
            Name: 'Casino B',
            states_id: 3,
            state: {
              Name: 'Michigan',
              Abbreviation: 'MI',
            },
            Offer_Name: 'Bonus 3',
            offer_type: 'Free Spins',
            Expected_Deposit: 50,
            Expected_Bonus: 100,
          },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClient.get.mockResolvedValueOnce(mockResponse as AxiosResponse);

      const result = await client.fetchAllActiveData();

      expect(result.promotions.get(101)).toHaveLength(2);
      expect(result.promotions.get(102)).toHaveLength(1);
    });

    it('should handle casinos with no promotions', async () => {
      const mockResponse = {
        data: [
          {
            casinodb_id: 101,
            Name: 'Casino A',
            states_id: 2,
            state: {
              Name: 'New Jersey',
              Abbreviation: 'NJ',
            },
          },
          {
            casinodb_id: 102,
            Name: 'Casino B',
            states_id: 3,
            state: {
              Name: 'Michigan',
              Abbreviation: 'MI',
            },
            Offer_Name: 'Bonus 1',
            offer_type: 'Deposit Bonus',
            Expected_Deposit: 100,
            Expected_Bonus: 200,
          },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClient.get.mockResolvedValueOnce(mockResponse as AxiosResponse);

      const result = await client.fetchAllActiveData();

      expect(result.casinos).toHaveLength(2);
      expect(result.promotions.has(101)).toBe(false);
      expect(result.promotions.get(102)).toHaveLength(1);
    });

    it('should deduplicate casinos with same casinodb_id', async () => {
      const mockResponse = {
        data: [
          {
            casinodb_id: 101,
            Name: 'Casino A',
            states_id: 2,
            state: {
              Name: 'New Jersey',
              Abbreviation: 'NJ',
            },
            Offer_Name: 'Bonus 1',
            offer_type: 'Deposit Bonus',
            Expected_Deposit: 100,
            Expected_Bonus: 200,
          },
          {
            casinodb_id: 101,
            Name: 'Casino A',
            states_id: 2,
            state: {
              Name: 'New Jersey',
              Abbreviation: 'NJ',
            },
            Offer_Name: 'Bonus 2',
            offer_type: 'No Deposit',
            Expected_Deposit: 0,
            Expected_Bonus: 50,
          },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockHttpClient.get.mockResolvedValueOnce(mockResponse as AxiosResponse);

      const result = await client.fetchAllActiveData();

      expect(result.casinos).toHaveLength(1);
      expect(result.promotions.get(101)).toHaveLength(2);
    });
  });
});
