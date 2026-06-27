import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.decorator';

// Safe Redis client wrapper - works whether Redis is configured or not
class SafeRedis {
  private realClient: Redis | null = null;
  private isConnected = false;

  constructor(private config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL');

    if (redisUrl) {
      try {
        this.realClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
        });
      } catch (e) {
        // If Redis connection fails, we'll use fallback
        this.realClient = null;
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.realClient) return null;
    try { return await this.realClient.get(key); } catch { return null; }
  }
  async set(key: string, value: string): Promise<string> {
    if (!this.realClient) return 'OK';
    try { return await this.realClient.set(key, value); } catch { return 'OK'; }
  }
  async setex(key: string, ttl: number, value: string): Promise<string> {
    if (!this.realClient) return 'OK';
    try { return await this.realClient.setex(key, ttl, value); } catch { return 'OK'; }
  }
  async del(key: string): Promise<number> {
    if (!this.realClient) return 0;
    try { return await this.realClient.del(key); } catch { return 0; }
  }
  async incr(key: string): Promise<number> {
    if (!this.realClient) return 1;
    try { return await this.realClient.incr(key); } catch { return 1; }
  }
  async expire(key: string, ttl: number): Promise<number> {
    if (!this.realClient) return 1;
    try { return await this.realClient.expire(key, ttl); } catch { return 1; }
  }
  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.realClient) return 0;
    try { return await this.realClient.zadd(key, score, member); } catch { return 0; }
  }
  async zcard(key: string): Promise<number> {
    if (!this.realClient) return 0;
    try { return await this.realClient.zcard(key); } catch { return 0; }
  }
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.realClient) return [];
    try { return await this.realClient.zrange(key, start, stop); } catch { return []; }
  }
  async zremrangebyscore(key: string, min: string, max: string): Promise<number> {
    if (!this.realClient) return 0;
    try { return await this.realClient.zremrangebyscore(key, min, max); } catch { return 0; }
  }

  // Required by rate-limiter - just a no-op
  defineCommand(name: string, opts?: unknown): void {
    // No-op for when Redis is not configured
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new SafeRedis(config);
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
