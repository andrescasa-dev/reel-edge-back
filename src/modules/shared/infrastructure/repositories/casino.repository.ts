import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import {
  ICasinoRepository,
  CreateCasinoData,
  UpdateCasinoData,
} from '../../domain/interfaces/casino.repository.interface';
import { Casino } from '../../domain/entities/casino.entity';
import { StateAbbreviation } from '../../domain/enums/state.enum';
import {
  CasinoNotFoundException,
  DatabaseException,
} from '../../domain/exceptions';
import { Prisma, Casino as PrismaCasino } from '@prisma/client';

/**
 * Casino Repository Implementation
 * Handles persistence for Casino entities using Prisma
 */
@Injectable()
export class CasinoRepository implements ICasinoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Casino | null> {
    try {
      const casino = await this.prisma.casino.findUnique({
        where: { id },
      });

      return casino ? this.toDomain(casino) : null;
    } catch (error) {
      throw new DatabaseException('findById', error as Error);
    }
  }

  async findByCasinoDbId(casinoDbId: number): Promise<Casino | null> {
    try {
      const casino = await this.prisma.casino.findUnique({
        where: { casinodb_id: casinoDbId },
      });

      return casino ? this.toDomain(casino) : null;
    } catch (error) {
      throw new DatabaseException('findByCasinoDbId', error as Error);
    }
  }

  async findAll(): Promise<Casino[]> {
    try {
      const casinos = await this.prisma.casino.findMany({
        orderBy: { name: 'asc' },
      });

      return casinos.map((casino) => this.toDomain(casino));
    } catch (error) {
      throw new DatabaseException('findAll', error as Error);
    }
  }

  async findByState(state: StateAbbreviation): Promise<Casino[]> {
    try {
      const casinos = await this.prisma.casino.findMany({
        where: { state },
        orderBy: { name: 'asc' },
      });

      return casinos.map((casino) => this.toDomain(casino));
    } catch (error) {
      throw new DatabaseException('findByState', error as Error);
    }
  }

  async findByStates(states: StateAbbreviation[]): Promise<Casino[]> {
    try {
      const casinos = await this.prisma.casino.findMany({
        where: {
          state: {
            in: states,
          },
        },
        orderBy: [{ state: 'asc' }, { name: 'asc' }],
      });

      return casinos.map((casino) => this.toDomain(casino));
    } catch (error) {
      throw new DatabaseException('findByStates', error as Error);
    }
  }

  async searchByName(
    name: string,
    state?: StateAbbreviation,
  ): Promise<Casino[]> {
    try {
      const casinos = await this.prisma.casino.findMany({
        where: {
          name: {
            contains: name,
            mode: 'insensitive',
          },
          ...(state && { state }),
        },
        orderBy: { name: 'asc' },
      });

      return casinos.map((casino) => this.toDomain(casino));
    } catch (error) {
      throw new DatabaseException('searchByName', error as Error);
    }
  }

  async create(casino: CreateCasinoData): Promise<Casino> {
    try {
      const created = await this.prisma.casino.create({
        data: {
          casinodb_id: casino.casinodb_id,
          name: casino.name,
          state: casino.state,
          website: casino.website,
          regulatoryId: casino.regulatoryId,
        },
      });

      return this.toDomain(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DatabaseException(
          'create',
          new Error('Casino with this casinodb_id already exists'),
        );
      }
      throw new DatabaseException('create', error as Error);
    }
  }

  async update(id: string, data: UpdateCasinoData): Promise<Casino> {
    try {
      const updated = await this.prisma.casino.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.state && { state: data.state }),
          ...(data.website !== undefined && { website: data.website }),
          ...(data.regulatoryId !== undefined && {
            regulatoryId: data.regulatoryId,
          }),
        },
      });

      return this.toDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new CasinoNotFoundException(id);
      }
      throw new DatabaseException('update', error as Error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.casino.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new CasinoNotFoundException(id);
      }
      throw new DatabaseException('delete', error as Error);
    }
  }

  async existsByNameAndState(
    name: string,
    state: StateAbbreviation,
  ): Promise<boolean> {
    try {
      const count = await this.prisma.casino.count({
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
      return await this.prisma.casino.count({
        where: { state },
      });
    } catch (error) {
      throw new DatabaseException('countByState', error as Error);
    }
  }

  private toDomain(prismaModel: PrismaCasino): Casino {
    return Casino.create({
      id: prismaModel.id,
      casinodb_id: prismaModel.casinodb_id,
      name: prismaModel.name,
      state: prismaModel.state as StateAbbreviation,
      website: prismaModel.website ?? undefined,
      regulatoryId: prismaModel.regulatoryId ?? undefined,
      createdAt: prismaModel.createdAt,
      updatedAt: prismaModel.updatedAt,
    });
  }
}
