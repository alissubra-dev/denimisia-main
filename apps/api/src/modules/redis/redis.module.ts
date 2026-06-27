import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.decorator';

// Dummy Redis client that does nothing when Redis is not configured
class DummyRedis {
  async get() { return null; }
  async set() { return 'OK'; }
  async setex() { return 'OK'; }
  async del() { return 0; }
  async incr() { return 1; }
  async expire() { return 1; }
  async zadd() { return 0; }
  async zcard() { return 0; }
  async zrange() { return []; }
  async zremrangebyscore() { return 0; }
}

function createRedisClient(config: ConfigService): Redis {
  const redisUrl = config.get<string>('REDIS_URL');

  // If REDIS_URL is not provided, return dummy client
  if (!redisUrl) {
    return new DummyRedis() as unknown as Redis;
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
