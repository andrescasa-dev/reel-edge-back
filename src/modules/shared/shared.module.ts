import { Module, Global } from '@nestjs/common';
import { PrismaModule } from './infrastructure/database/prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [],
  exports: [PrismaModule],
})
export class SharedModule {}
