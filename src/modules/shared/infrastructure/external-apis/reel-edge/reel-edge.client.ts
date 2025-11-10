import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { isValidState } from '../../../domain/enums';
import { Casino } from '../../../domain/entities/casino.entity';
import { Promotion } from '../../../../promotion-research/domain/entities/promotion.entity';
import { ReelEdgeAPIException } from '../../../domain/exceptions/reel-edge-api.exception';
import { HttpClient } from '../http-client';

/**
 * Response structure from Reel Edge API
 */
interface ReelEdgeAPIResponse {
  casinodb_id: number;
  Offer_Name?: string;
  offer_type?: string;
  Expected_Deposit?: number;
  Expected_Bonus?: number;
  Name: string;
  states_id: number;
  state: {
    Name: string;
    Abbreviation: string;
  };
  Terms_And_Conditions?: string;
  Wagering_Requirements?: string;
  Valid_From?: string;
  Valid_Until?: string;
  website?: string;
  Regulatory_Id?: string;
}

/**
 * Structured data returned by client
 */
export interface ReelEdgeData {
  casinos: Casino[];
  promotions: Map<number, Promotion[]>;
}

/**
 * ReelEdgeDBClient - Fetches casino and promotion data from Reel Edge DB
 * Focused on business logic: API calls and data transformation
 */
@Injectable()
export class ReelEdgeDBClient {
  private readonly logger = new Logger(ReelEdgeDBClient.name);
  private readonly httpClient: HttpClient;

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.get<string>('reelEdge.apiUrl') || '';

    this.httpClient = new HttpClient(
      {
        baseURL,
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
      },
      ReelEdgeDBClient.name,
    );

    this.logger.log(`Initialized ReelEdgeDBClient with base URL: ${baseURL}`);
  }

  /**
   * Fetch all active casinos and promotions from Reel Edge DB
   * Called ONCE per research job - returns all data for caching
   */
  async fetchAllActiveData(): Promise<ReelEdgeData> {
    this.logger.log('Starting fetch of all active data from Reel Edge DB');

    const startTime = Date.now();

    try {
      const response =
        await this.httpClient.get<ReelEdgeAPIResponse[]>('/activeSUB');

      if (!response.data) {
        throw ReelEdgeAPIException.invalidResponse('Empty response body');
      }

      const rawData = response.data;

      this.logger.log(
        `Successfully fetched ${rawData.length} records from Reel Edge DB in ${Date.now() - startTime}ms`,
      );

      const transformedData = this.transformData(rawData);

      this.logger.log(
        `Transformed data: ${transformedData.casinos.length} casinos, ` +
          `${this.countTotalPromotions(transformedData.promotions)} promotions`,
      );

      return transformedData;
    } catch (error) {
      this.logger.error('Failed to fetch data from Reel Edge DB', error);
      throw this.handleError(error);
    }
  }

  /**
   * Transform raw API response to domain entities
   */
  private transformData(rawData: ReelEdgeAPIResponse[]): ReelEdgeData {
    const casinoMap = new Map<number, Casino>();
    const promotionMap = new Map<number, Promotion[]>();

    for (const record of rawData) {
      try {
        const stateAbbreviation = record.state.Abbreviation;

        if (!isValidState(stateAbbreviation)) {
          this.logger.warn(
            `Skipping record with invalid state: ${stateAbbreviation} for casino ${record.Name}`,
          );
          continue;
        }

        const casinodb_id = record.casinodb_id;

        if (!casinoMap.has(casinodb_id)) {
          const casino = Casino.create({
            id: String(casinodb_id),
            casinodb_id: casinodb_id,
            name: record.Name,
            state: stateAbbreviation,
            website: record.website,
            regulatoryId: record.Regulatory_Id,
          });

          casinoMap.set(casinodb_id, casino);
        }

        if (
          record.Offer_Name &&
          record.offer_type &&
          record.Expected_Deposit !== undefined &&
          record.Expected_Bonus !== undefined
        ) {
          const promotion = Promotion.create({
            offerName: record.Offer_Name,
            offerType: record.offer_type,
            expectedDeposit: record.Expected_Deposit,
            expectedBonus: record.Expected_Bonus,
            termsAndConditions: record.Terms_And_Conditions,
            wageringRequirements: record.Wagering_Requirements,
            validFrom: record.Valid_From
              ? new Date(record.Valid_From)
              : undefined,
            validUntil: record.Valid_Until
              ? new Date(record.Valid_Until)
              : undefined,
          });

          if (!promotionMap.has(casinodb_id)) {
            promotionMap.set(casinodb_id, []);
          }

          promotionMap.get(casinodb_id)!.push(promotion);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to transform record for casino ${record.Name}`,
          error,
        );
      }
    }

    return {
      casinos: Array.from(casinoMap.values()),
      promotions: promotionMap,
    };
  }

  /**
   * Count total promotions across all casinos
   */
  private countTotalPromotions(promotionMap: Map<number, Promotion[]>): number {
    let count = 0;
    for (const promotions of promotionMap.values()) {
      count += promotions.length;
    }
    return count;
  }

  /**
   * Handle and transform errors to ReelEdgeAPIException
   */
  private handleError(error: unknown): ReelEdgeAPIException {
    if (error instanceof ReelEdgeAPIException) {
      return error;
    }

    if (this.httpClient.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.code === 'ECONNABORTED') {
        return ReelEdgeAPIException.timeout();
      }

      if (!axiosError.response) {
        return ReelEdgeAPIException.networkError(axiosError);
      }

      const status = axiosError.response.status;
      const message = axiosError.message || 'Unknown error';

      return ReelEdgeAPIException.apiError(status, message);
    }

    if (error instanceof Error) {
      return ReelEdgeAPIException.networkError(error);
    }

    return new ReelEdgeAPIException('Unknown error occurred');
  }
}
