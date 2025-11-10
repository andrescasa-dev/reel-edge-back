import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma/prisma.service';
import { CreateTestItemDto } from '../../presentation/dtos/create-test-item.dto';
import { UpdateTestItemDto } from '../../presentation/dtos/update-test-item.dto';

@Injectable()
export class TestItemService {
  constructor(private prisma: PrismaService) {}

  async create(createTestItemDto: CreateTestItemDto) {
    return this.prisma.testItem.create({
      data: createTestItemDto,
    });
  }

  async findAll() {
    return this.prisma.testItem.findMany();
  }

  async findOne(id: number) {
    return this.prisma.testItem.findUnique({
      where: { id },
    });
  }

  async update(id: number, updateTestItemDto: UpdateTestItemDto) {
    return this.prisma.testItem.update({
      where: { id },
      data: updateTestItemDto,
    });
  }

  async remove(id: number) {
    return this.prisma.testItem.delete({
      where: { id },
    });
  }
}
