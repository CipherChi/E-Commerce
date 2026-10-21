import { rateLimit } from '../middleware/rate-limit';

describe('Redis backed Express rate limiter', () => {
  it('fails closed with 503 when Redis cannot be initialized', async () => {
    const middleware = rateLimit(5, 60_000, 'invalid-redis-url', 'redis-test');
    const next = jest.fn();
    middleware({ ip: '192.0.2.9' } as never, {} as never, next);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(next.mock.calls[0][0].getStatus()).toBe(503);
    expect(next.mock.calls[0][0].getResponse()).toMatchObject({ statusCode: 503, message: 'Rate limiting is unavailable' });
  });
});
