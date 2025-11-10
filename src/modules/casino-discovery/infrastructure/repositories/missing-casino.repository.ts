import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma/prisma.service';
import {
  IMissingCasinoRepository,
  CreateMissingCasinoData,
  UpdateMissingCasinoData,
} from '../../domain/interfaces/missing-casino.repository.interface';
import { MissingCasino } from '../../domain/entities/missing-casino.entity';
import { StateAbbreviation } from '../../../shared/domain/enums/state.enum';
import {
  MissingCasinoNotFoundException,
  DatabaseException,
} from '../../../shared/domain/exceptions';
import { Prisma, MissingCasino as PrismaMissingCasino } from '@prisma/client';

/**
 * Missing Casino Repository Implementation
 * Handles persistence for MissingCasino entities using Prisma
 */
@Injectable()
export class MissingCasinoRepository implements IMissingCasinoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<MissingCasino | null> {
    try {
      const missingCasino = await this.prisma.missingCasino.findUnique({
        where: { id },
      });

      return missingCasino ? this.toDomain(missingCasino) : null;
    } catch (error) {
      throw new DatabaseException('findById', error as Error);
    }
  }

  async findAll(filters?: {
    state?: StateAbbreviation;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<MissingCasino[]> {
    try {
      const where: Prisma.MissingCasinoWhereInput = {};

      if (filters?.state) {
        where.state = filters.state;
      }

      if (filters?.search) {
        where.name = {
          contains: filters.search,
          mode: 'insensitive',
        };
      }

      const missingCasinos = await this.prisma.missingCasino.findMany({
        where,
        orderBy: { discoveredAt: 'desc' },
        take: filters?.limit,
        skip: filters?.offset,
      });

      return missingCasinos.map((casino) => this.toDomain(casino));
    } catch (error) {
      throw new DatabaseException('findAll', error as Error);
    }
  }

  async findByState(state: StateAbbreviation): Promise<MissingCasino[]> {
    try {
      const missingCasinos = await this.prisma.missingCasino.findMany({
        where: { state },
        orderBy: { name: 'asc' },
      });

      return missingCasinos.map((casino) => this.toDomain(casino));
    } catch (error) {
      throw new DatabaseException('findByState', error as Error);
    }
  }

  async searchByName(
    name: string,
    state?: StateAbbreviation,
  ): Promise<MissingCasino[]> {
    try {
      const missingCasinos = await this.prisma.missingCasino.findMany({
        where: {
          name: {
            contains: name,
            mode: 'insensitive',
          },
          ...(state && { state }),
        },
        orderBy: { name: 'asc' },
      });

      return missingCasinos.map((casino) => this.toDomain(casino));
    } catch (error) {
      throw new DatabaseException('searchByName', error as Error);
    }
  }

  async create(missingCasino: CreateMissingCasinoData): Promise<MissingCasino> {
    try {
      const created = await this.prisma.missingCasino.create({
        data: {
          name: missingCasino.name,
          state: missingCasino.state,
          source: missingCasino.source,
          website: missingCasino.website,
          regulatoryId: missingCasino.regulatoryId,
          promotionsFound: missingCasino.promotionsFound,
        },
      });

      return this.toDomain(created);
    } catch (error) {
      throw new DatabaseException('create', error as Error);
    }
  }

  async update(
    id: string,
    data: UpdateMissingCasinoData,
  ): Promise<MissingCasino> {
    try {
      const updated = await this.prisma.missingCasino.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.state && { state: data.state }),
          ...(data.source && { source: data.source }),
          ...(data.website !== undefined && { website: data.website }),
          ...(data.regulatoryId !== undefined && {
            regulatoryId: data.regulatoryId,
          }),
          ...(data.promotionsFound !== undefined && {
            promotionsFound: data.promotionsFound,
          }),
        },
      });

      return this.toDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new MissingCasinoNotFoundException(id);
      }
      throw new DatabaseException('update', error as Error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.missingCasino.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new MissingCasinoNotFoundException(id);
      }
      throw new DatabaseException('delete', error as Error);
    }
  }

  async existsByNameAndState(
    name: string,
    state: StateAbbreviation,
  ): Promise<boolean> {
    try {
      const count = await this.prisma.missingCasino.count({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
          state,
        },
      });

      return count > 0;
    } catch (error) {
      throw new DatabaseException('existsByNameAndState', error as Error);
    }
  }

  async countByState(state: StateAbbreviation): Promise<number> {
    try {
      return await this.prisma.missingCasino.count({
        where: { state },
      });
    } catch (error) {
      throw new DatabaseException('countByState', error as Error);
    }
  }

  async count(filters?: {
    state?: StateAbbreviation;
    search?: string;
  }): Promise<number> {
    try {
      const where: Prisma.MissingCasinoWhereInput = {};

      if (filters?.state) {
        where.state = filters.state;
      }

      if (filters?.search) {
        where.name = {
          contains: filters.search,
          mode: 'insensitive',
        };
      }

      return await this.prisma.missingCasino.count({ where });
    } catch (error) {
      throw new DatabaseException('count', error as Error);
    }
  }

  async updatePromotionsFound(
    id: string,
    count: number,
  ): Promise<MissingCasino> {
    try {
      const updated = await this.prisma.missingCasino.update({
        where: { id },
        data: { promotionsFound: count },
      });

      return this.toDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new MissingCasinoNotFoundException(id);
      }
      throw new DatabaseException('updatePromotionsFound', error as Error);
    }
  }

  private toDomain(prismaModel: PrismaMissingCasino): MissingCasino {
    return MissingCasino.create({
      id: prismaModel.id,
      name: prismaModel.name,
      state: prismaModel.state as StateAbbreviation,
      source: prismaModel.source,
      website: prismaModel.website ?? undefined,
      regulatoryId: prismaModel.regulatoryId ?? undefined,
      promotionsFound: prismaModel.promotionsFound,
      discoveredAt: prismaModel.discoveredAt,
    });
  }
}
