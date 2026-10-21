import { rateLimit } from '../middleware/rate-limit';

describe('Express rate limit middleware', () => {
  it('limits hits per route and client within the configured window', async () => {
    const middleware = rateLimit(1, 60_000, undefined, `rate-test-${Date.now()}`);
    const next = jest.fn();
    const req = { ip: '192.0.2.1' } as never;
    middleware(req, {} as never, next);
    middleware(req, {} as never, next);
    await new Promise((resolve) => setImmediate(resolve));
    expect(next).toHaveBeenNthCalledWith(1);
    expect(next.mock.calls[1][0]).toMatchObject({ statusCode: 429 });
  });
});
