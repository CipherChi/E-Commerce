import express = require('express');
import * as request from 'supertest';
import { requestIdMiddleware } from './request-id.middleware';
import { errorHandler } from '../middleware/error-handler';
import { captureRouteTemplate } from '../middleware/request-logger';
import { BadRequestException } from '../lib/http-errors';

describe('Express error middleware', () => {
  it('wraps known and unknown errors in the compatibility envelope', async () => {
    const logger = { error: jest.fn() };
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/bad', (_req, _res, next) => next(new BadRequestException('invalid input')));
    app.get('/crash', (_req, _res, next) => next(new Error('private detail')));
    app.get('/receipts/public/:token', captureRouteTemplate, (_req, _res, next) => next(new Error('receipt failure')));
    app.use(errorHandler(logger));

    const bad = await request(app).get('/bad?q=1').expect(400);
    expect(bad.body).toMatchObject({ statusCode: 400, message: { statusCode: 400 }, path: '/bad?q=1', requestId: expect.any(String) });
    const crash = await request(app).get('/crash').expect(500);
    expect(crash.body.message).toBe('Internal server error');
    expect(JSON.stringify(crash.body)).not.toContain('private detail');
    expect(logger.error).toHaveBeenCalledTimes(1);
    await request(app).get('/receipts/public/capability-token').expect(500);
    const safeLog = JSON.parse(logger.error.mock.calls[1][0]);
    expect(safeLog.path).toBe('/receipts/public/:token');
    expect(JSON.stringify(safeLog)).not.toContain('capability-token');
  });
});
