import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

describe('HttpLoggingInterceptor', () => {
  it('writes a structured request log with the request ID and excludes query values', async () => {
    const req = {
      method: 'GET',
      path: '/customers/guest-secret-token',
      route: { path: '/:id' },
      baseUrl: '/customers',
      requestId: 'request-123',
    };
    const response = { statusCode: 200 };
    const context = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => response }),
    } as unknown as ExecutionContext;
    const logger = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const interceptor = new HttpLoggingInterceptor();

    await lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') } as CallHandler));

    expect(logger).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logger.mock.calls[0][0])).toEqual({
      event: 'http_request',
      requestId: 'request-123',
      method: 'GET',
      path: '/customers/:id',
      statusCode: 200,
      durationMs: expect.any(Number),
    });
    expect(logger.mock.calls[0][0]).not.toContain('guest-secret-token');
    logger.mockRestore();
  });
});
