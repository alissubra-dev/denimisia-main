import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PathaoService } from './pathao.service';
import { PathaoController } from './pathao.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PathaoController],
  providers: [PathaoService],
  exports: [PathaoService],
})
export class PathaoModule {}