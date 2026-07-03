import { Module } from '@nestjs/common';
import { AdminSeedController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminSeedController],
})
export class AdminModule {}