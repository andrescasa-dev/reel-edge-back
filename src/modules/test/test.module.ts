import { Module } from '@nestjs/common';
import { TestItemService } from './application/services/test-item.service';
import { TestItemController } from './presentation/controllers/test-item.controller';

@Module({
  controllers: [TestItemController],
  providers: [TestItemService],
})
export class TestModule {}
