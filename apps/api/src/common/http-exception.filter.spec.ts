import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('includes the request ID in the standard error envelope', () => {
    const request = {
      method: 'POST', path: '/auth/login', url: '/auth/login', requestId: 'request-123',
      baseUrl: '', route: { path: '/auth/login' },
    };
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(new BadRequestException('invalid'), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, path: '/auth/login', requestId: 'request-123' }),
    );
  });

  it('uses a structured log for server errors', () => {
    const request = {
      method: 'GET', path: '/resource', url: '/resource?token=secret', requestId: 'request-456',
      baseUrl: '', route: { path: '/resource/:id' },
    };
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ArgumentsHost;
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    new HttpExceptionFilter().catch(new Error('failure'), host);

    const structured = JSON.parse(logger.mock.calls[0][0]);
    expect(structured).toEqual({
      event: 'http_exception',
      requestId: 'request-456',
      method: 'GET',
      path: '/resource/:id',
      statusCode: 500,
    });
    expect(JSON.stringify(structured)).not.toContain('secret');
    logger.mockRestore();
  });
});
