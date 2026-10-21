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
    app.get('/crash-with-response', (_req, _res, next) => next(Object.assign(new Error('private detail'), { statusCode: 500, response: { secret: 'database-password' } })));
    app.get('/receipts/public/:token', captureRouteTemplate, (_req, _res, next) => next(new Error('receipt failure')));
    app.use('/pre-route/:token', (_req, _res, next) => next(new Error('parser failure')));
    app.use(errorHandler(logger));

    const bad = await request(app).get('/bad?q=1').expect(400);
    expect(bad.body).toMatchObject({ statusCode: 400, message: { statusCode: 400 }, path: '/bad?q=1', requestId: expect.any(String) });
    const crash = await request(app).get('/crash').expect(500);
    expect(crash.body.message).toBe('Internal server error');
    expect(JSON.stringify(crash.body)).not.toContain('private detail');
    const crashWithResponse = await request(app).get('/crash-with-response').expect(500);
    expect(crashWithResponse.body.message).toBe('Internal server error');
    expect(JSON.stringify(crashWithResponse.body)).not.toContain('database-password');
    expect(logger.error).toHaveBeenCalledTimes(2);
    await request(app).get('/receipts/public/capability-token').expect(500);
    const safeLog = JSON.parse(logger.error.mock.calls[2][0]);
    expect(safeLog.path).toBe('/receipts/public/:token');
    expect(JSON.stringify(safeLog)).not.toContain('capability-token');
    await request(app).get('/pre-route/access-secret-token').expect(500);
    const unmatchedLog = JSON.parse(logger.error.mock.calls[3][0]);
    expect(unmatchedLog.path).toBe('unmatched');
    expect(JSON.stringify(unmatchedLog)).not.toContain('access-secret-token');
  });
});
