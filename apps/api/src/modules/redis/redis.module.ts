import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.decorator';

function createRedisClient(config: ConfigService): Redis | null {
  const redisUrl = config.get<string>('REDIS_URL');

  // If REDIS_URL is not provided, return null (no Redis)
  if (!redisUrl) {
    return null;
  }

  return new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return createRedisClient(config);
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
