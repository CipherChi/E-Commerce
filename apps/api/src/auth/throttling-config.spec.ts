import { RedisThrottlerStorage } from '../common/redis-throttler.storage';
import { throttlingConfig } from './throttling-config';

describe('throttlingConfig', () => {
  it('uses in-memory storage when REDIS_URL is unset', () => {
    const config = throttlingConfig();
    expect(Array.isArray(config) ? config : config.throttlers).toEqual([{ ttl: 60_000, limit: 5 }]);
    expect(Array.isArray(config) ? undefined : config.storage).toBeUndefined();
  });

  it('configures Redis storage when REDIS_URL is provided', () => {
    const config = throttlingConfig('redis://localhost:6379');
    expect(Array.isArray(config) ? undefined : config.storage).toBeInstanceOf(RedisThrottlerStorage);
  });
});
