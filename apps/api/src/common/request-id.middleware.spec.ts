import { NextFunction, Request, Response } from 'express';
import { requestIdMiddleware } from './request-id.middleware';

describe('requestIdMiddleware', () => {
  it('generates a request ID, exposes it on the request and response, and continues', () => {
    const req = {} as Request & { requestId?: string };
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not trust a caller-supplied request ID', () => {
    const req = { headers: { 'x-request-id': 'untrusted-value' } } as unknown as Request & { requestId?: string };
    const res = { setHeader: jest.fn() } as unknown as Response;

    requestIdMiddleware(req, res, jest.fn());

    expect(req.requestId).not.toBe('untrusted-value');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
  });
});
