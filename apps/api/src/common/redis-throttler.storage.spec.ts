import { ServiceUnavailableException } from '@nestjs/common';
import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  it('returns throttler counters from the atomic Redis operation', async () => {
    const storage = new RedisThrottlerStorage('redis://localhost:6379');
    const evalScript = jest.fn().mockResolvedValue([4, 12_000, 1, 5_000]);
    (storage as any).client = { isOpen: true, eval: evalScript };
    await expect(storage.increment('client', 60_000, 3, 5_000, 'default')).resolves.toEqual({
      totalHits: 4, timeToExpire: 12_000, isBlocked: true, timeToBlockExpire: 5_000,
    });
    expect(evalScript).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      keys: ['throttle:default:client', 'throttle:default:client:blocked'],
      arguments: ['60000', '3', '5000'],
    }));
  });

  it('fails closed with 503 on Redis failure and retries after a connection error', async () => {
    const storage = new RedisThrottlerStorage('redis://localhost:6379');
    let isOpen = false;
    const connect = jest.fn()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockImplementationOnce(async () => { isOpen = true; });
    const evalScript = jest.fn()
      .mockRejectedValueOnce(new Error('Redis evaluation failed'))
      .mockResolvedValueOnce([1, 60_000, 0, 0]);
    (storage as any).client = {
      get isOpen() { return isOpen; },
      connect,
      eval: evalScript,
      quit: jest.fn().mockResolvedValue('OK'),
    };

    await expect(storage.increment('client', 60_000, 3, 5_000, 'default'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(evalScript).not.toHaveBeenCalled();

    await expect(storage.increment('client', 60_000, 3, 5_000, 'default'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(storage.increment('client', 60_000, 3, 5_000, 'default'))
      .resolves.toMatchObject({ totalHits: 1, isBlocked: false });
    expect(connect).toHaveBeenCalledTimes(2);
    expect(evalScript).toHaveBeenCalledTimes(2);
    await storage.onModuleDestroy();
  });
});
