import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma/prisma.service';
import {
  IPromotionComparisonRepository,
  CreatePromotionComparisonData,
  UpdatePromotionComparisonData,
} from '../../domain/interfaces/promotion-comparison.repository.interface';
import { PromotionComparison } from '../../domain/entities/promotion-comparison.entity';
import { Promotion } from '../../domain/entities/promotion.entity';
import { ComparisonType } from '../../../shared/domain/enums/comparison-type.enum';
import { ComparisonStatus } from '../../../shared/domain/enums/comparison-status.enum';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';
import {
  ComparisonNotFoundException,
  DatabaseException,
} from '../../../shared/domain/exceptions';
import {
  Prisma,
  PromotionComparison as PrismaPromotionComparison,
} from '@prisma/client';

/**
 * Promotion Comparison Repository Implementation
 * Handles persistence for PromotionComparison entities with offset-based pagination and multi-field filtering
 */
@Injectable()
export class PromotionComparisonRepository
  implements IPromotionComparisonRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PromotionComparison | null> {
    try {
      const comparison = await this.prisma.promotionComparison.findUnique({
        where: { id },
        include: { casino: true },
      });

      return comparison ? this.toDomain(comparison) : null;
    } catch (error) {
      throw new DatabaseException('findById', error as Error);
    }
  }

  async findAll(filters?: {
    casinoId?: string;
    state?: StateAbbreviation;
    offerType?: string;
    comparisonType?: ComparisonType;
    status?: ComparisonStatus;
    promotionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PromotionComparison[]> {
    try {
      const where: Prisma.PromotionComparisonWhereInput = {};

      if (filters?.casinoId) {
        where.casinoId = filters.casinoId;
      }

      if (filters?.state) {
        where.casino = {
          state: filters.state,
        };
      }

      if (filters?.offerType) {
        where.discoveredOfferType = filters.offerType;
      }

      if (filters?.comparisonType) {
        where.comparisonType = filters.comparisonType;
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.promotionId) {
        where.id = filters.promotionId;
      }

      const comparisons = await this.prisma.promotionComparison.findMany({
        where,
        include: { casino: true },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit,
        skip: filters?.offset,
      });

      return comparisons.map((comparison) => this.toDomain(comparison));
    } catch (error) {
      throw new DatabaseException('findAll', error as Error);
    }
  }

  async findByCasino(casinoId: string): Promise<PromotionComparison[]> {
    try {
      const comparisons = await this.prisma.promotionComparison.findMany({
        where: { casinoId },
        include: { casino: true },
        orderBy: { createdAt: 'desc' },
      });

      return comparisons.map((comparison) => this.toDomain(comparison));
    } catch (error) {
      throw new DatabaseException('findByCasino', error as Error);
    }
  }

  async findByStatus(status: ComparisonStatus): Promise<PromotionComparison[]> {
    try {
      const comparisons = await this.prisma.promotionComparison.findMany({
        where: { status },
        include: { casino: true },
        orderBy: { createdAt: 'desc' },
      });

      return comparisons.map((comparison) => this.toDomain(comparison));
    } catch (error) {
      throw new DatabaseException('findByStatus', error as Error);
    }
  }

  async findByComparisonType(
    comparisonType: ComparisonType,
  ): Promise<PromotionComparison[]> {
    try {
      const comparisons = await this.prisma.promotionComparison.findMany({
        where: { comparisonType },
        include: { casino: true },
        orderBy: { createdAt: 'desc' },
      });

      return comparisons.map((comparison) => this.toDomain(comparison));
    } catch (error) {
      throw new DatabaseException('findByComparisonType', error as Error);
    }
  }

  async create(
    comparison: CreatePromotionComparisonData,
  ): Promise<PromotionComparison> {
    try {
      const created = await this.prisma.promotionComparison.create({
        data: {
          casinoId: comparison.casinoId,
          currentOfferName: comparison.currentPromotion?.offerName,
          currentOfferType: comparison.currentPromotion?.offerType,
          currentExpectedDeposit: comparison.currentPromotion?.expectedDeposit,
          currentExpectedBonus: comparison.currentPromotion?.expectedBonus,
          currentTermsAndConditions:
            comparison.currentPromotion?.termsAndConditions,
          currentWageringRequirements:
            comparison.currentPromotion?.wageringRequirements,
          discoveredOfferName: comparison.discoveredPromotion.offerName,
          discoveredOfferType: comparison.discoveredPromotion.offerType,
          discoveredExpectedDeposit:
            comparison.discoveredPromotion.expectedDeposit,
          discoveredExpectedBonus: comparison.discoveredPromotion.expectedBonus,
          discoveredTermsAndConditions:
            comparison.discoveredPromotion.termsAndConditions,
          discoveredWageringRequirements:
            comparison.discoveredPromotion.wageringRequirements,
          discoveredValidFrom: comparison.discoveredPromotion.validFrom,
          discoveredValidUntil: comparison.discoveredPromotion.validUntil,
          comparisonType: comparison.comparisonType,
          status: comparison.status,
          sources: comparison.sources,
          notes: comparison.notes,
        },
        include: { casino: true },
      });

      return this.toDomain(created);
    } catch (error) {
      throw new DatabaseException('create', error as Error);
    }
  }

  async update(
    id: string,
    data: UpdatePromotionComparisonData,
  ): Promise<PromotionComparison> {
    try {
      const updateData: Prisma.PromotionComparisonUpdateInput = {};

      if (data.status) {
        updateData.status = data.status;
      }

      if (data.notes !== undefined) {
        updateData.notes = data.notes;
      }

      if (data.comparisonType) {
        updateData.comparisonType = data.comparisonType;
      }

      const updated = await this.prisma.promotionComparison.update({
        where: { id },
        data: updateData,
        include: { casino: true },
      });

      return this.toDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ComparisonNotFoundException(id);
      }
      throw new DatabaseException('update', error as Error);
    }
  }

  async updateStatus(
    id: string,
    status: ComparisonStatus,
    notes?: string,
  ): Promise<PromotionComparison> {
    try {
      const updated = await this.prisma.promotionComparison.update({
        where: { id },
        data: {
          status,
          ...(notes !== undefined && { notes }),
        },
        include: { casino: true },
      });

      return this.toDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ComparisonNotFoundException(id);
      }
      throw new DatabaseException('updateStatus', error as Error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.promotionComparison.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ComparisonNotFoundException(id);
      }
      throw new DatabaseException('delete', error as Error);
    }
  }

  async count(filters?: {
    casinoId?: string;
    state?: StateAbbreviation;
    offerType?: string;
    comparisonType?: ComparisonType;
    status?: ComparisonStatus;
  }): Promise<number> {
    try {
      const where: Prisma.PromotionComparisonWhereInput = {};

      if (filters?.casinoId) {
        where.casinoId = filters.casinoId;
      }

      if (filters?.state) {
        where.casino = {
          state: filters.state,
        };
      }

      if (filters?.offerType) {
        where.discoveredOfferType = filters.offerType;
      }

      if (filters?.comparisonType) {
        where.comparisonType = filters.comparisonType;
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      return await this.prisma.promotionComparison.count({ where });
    } catch (error) {
      throw new DatabaseException('count', error as Error);
    }
  }

  async countByStatus(status: ComparisonStatus): Promise<number> {
    try {
      return await this.prisma.promotionComparison.count({
        where: { status },
      });
    } catch (error) {
      throw new DatabaseException('countByStatus', error as Error);
    }
  }

  async countByComparisonType(comparisonType: ComparisonType): Promise<number> {
    try {
      return await this.prisma.promotionComparison.count({
        where: { comparisonType },
      });
    } catch (error) {
      throw new DatabaseException('countByComparisonType', error as Error);
    }
  }

  async existsForCasinoAndOffer(
    casinoId: string,
    offerName: string,
  ): Promise<boolean> {
    try {
      const count = await this.prisma.promotionComparison.count({
        where: {
          casinoId,
          discoveredOfferName: offerName,
        },
      });

      return count > 0;
    } catch (error) {
      throw new DatabaseException('existsForCasinoAndOffer', error as Error);
    }
  }

  private toDomain(
    prismaModel: PrismaPromotionComparison,
  ): PromotionComparison {
    const currentPromotion =
      prismaModel.currentOfferName &&
      prismaModel.currentOfferType &&
      prismaModel.currentExpectedDeposit !== null &&
      prismaModel.currentExpectedBonus !== null
        ? Promotion.create({
            offerName: prismaModel.currentOfferName,
            offerType: prismaModel.currentOfferType,
            expectedDeposit: prismaModel.currentExpectedDeposit,
            expectedBonus: prismaModel.currentExpectedBonus,
            termsAndConditions:
              prismaModel.currentTermsAndConditions ?? undefined,
            wageringRequirements:
              prismaModel.currentWageringRequirements ?? undefined,
          })
        : null;

    const discoveredPromotion = Promotion.create({
      offerName: prismaModel.discoveredOfferName,
      offerType: prismaModel.discoveredOfferType,
      expectedDeposit: prismaModel.discoveredExpectedDeposit,
      expectedBonus: prismaModel.discoveredExpectedBonus,
      termsAndConditions: prismaModel.discoveredTermsAndConditions ?? undefined,
      wageringRequirements:
        prismaModel.discoveredWageringRequirements ?? undefined,
      validFrom: prismaModel.discoveredValidFrom ?? undefined,
      validUntil: prismaModel.discoveredValidUntil ?? undefined,
    });

    return PromotionComparison.create({
      id: prismaModel.id,
      casinoId: prismaModel.casinoId,
      currentPromotion,
      discoveredPromotion,
      comparisonType: prismaModel.comparisonType as ComparisonType,
      status: prismaModel.status as ComparisonStatus,
      sources: Array.isArray(prismaModel.sources)
        ? (prismaModel.sources as string[])
        : (JSON.parse((prismaModel.sources as string) || '[]') as string[]),
      notes: prismaModel.notes ?? undefined,
      createdAt: prismaModel.createdAt,
      updatedAt: prismaModel.updatedAt,
    });
  }
}
