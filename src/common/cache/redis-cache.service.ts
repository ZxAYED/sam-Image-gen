import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly ttlSeconds = 3600;
  private readonly redis: Redis | null;

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL')?.trim();
    if (!redisUrl) {
      this.redis = null;
      this.logger.warn('REDIS_URL is not configured. Redis cache is disabled.');
      return;
    }

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    this.redis.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis error: ${message}`);
    });
  }

  async getJson<T>(key: string): Promise<T | null> {
    const redis = this.redis;
    if (!redis) {
      return null;
    }
    try {
      await redis.connect().catch(() => undefined);
      const raw = await redis.get(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis get failed for key=${key}: ${message}`);
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds = this.ttlSeconds,
  ): Promise<void> {
    const redis = this.redis;
    if (!redis) {
      return;
    }
    try {
      await redis.connect().catch(() => undefined);
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis set failed for key=${key}: ${message}`);
    }
  }

  async del(key: string): Promise<void> {
    const redis = this.redis;
    if (!redis) {
      return;
    }
    try {
      await redis.connect().catch(() => undefined);
      await redis.del(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis del failed for key=${key}: ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    const redis = this.redis;
    if (!redis) {
      return;
    }
    await redis.quit().catch(() => undefined);
  }
}
