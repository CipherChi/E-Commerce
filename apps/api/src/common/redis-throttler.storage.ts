import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { createClient, RedisClientType } from 'redis';

const incrementScript = `
local blocked = redis.call('PTTL', KEYS[2])
if blocked > 0 then
  return { tonumber(redis.call('GET', KEYS[1]) or '0'), redis.call('PTTL', KEYS[1]), 1, blocked }
end
local total = redis.call('INCR', KEYS[1])
if total == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if total > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return { total, ttl, 1, tonumber(ARGV[3]) }
end
return { total, ttl, 0, 0 }
`;

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly client: RedisClientType;
  private connecting?: Promise<void>;

  constructor(url: string) {
    this.client = createClient({ url });
    this.client.on('error', () => this.logger.warn('Redis throttler storage connection error'));
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      if (!this.client.isOpen) {
        this.connecting ??= this.client.connect().then(() => undefined).catch((error) => {
          this.connecting = undefined;
          throw error;
        });
        await this.connecting;
      }
      const redisKey = `throttle:${throttlerName}:${key}`;
      const result = (await this.client.eval(incrementScript, {
        keys: [redisKey, `${redisKey}:blocked`],
        arguments: [String(ttl), String(limit), String(blockDuration)],
      })) as number[];
      return {
        totalHits: Number(result[0]),
        timeToExpire: Math.max(0, Number(result[1])),
        isBlocked: Number(result[2]) === 1,
        timeToBlockExpire: Math.max(0, Number(result[3])),
      };
    } catch {
      // Throttling must fail closed: the guard will not invoke the protected handler.
      this.connecting = undefined;
      throw new ServiceUnavailableException('Rate limiting is unavailable');
    }
  }

  async onModuleDestroy() {
    if (this.client.isOpen) await this.client.quit();
  }
}
