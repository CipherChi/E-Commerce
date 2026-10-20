import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { RedisThrottlerStorage } from '../common/redis-throttler.storage';

export function throttlingConfig(redisUrl?: string): ThrottlerModuleOptions {
  return {
    throttlers: [{ ttl: 60_000, limit: 5 }],
    ...(redisUrl ? { storage: new RedisThrottlerStorage(redisUrl) } : {}),
  };
}
