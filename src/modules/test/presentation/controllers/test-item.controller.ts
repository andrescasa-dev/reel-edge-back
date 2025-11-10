import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { TestItemService } from '../../application/services/test-item.service';
import { CreateTestItemDto } from '../dtos/create-test-item.dto';
import { UpdateTestItemDto } from '../dtos/update-test-item.dto';

@Controller('test-items')
export class TestItemController {
  constructor(private readonly testItemService: TestItemService) {}

  @Post()
  create(@Body() createTestItemDto: CreateTestItemDto) {
    return this.testItemService.create(createTestItemDto);
  }

  @Get()
  findAll() {
    return this.testItemService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.testItemService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTestItemDto: UpdateTestItemDto,
  ) {
    return this.testItemService.update(id, updateTestItemDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.testItemService.remove(id);
  }
}
