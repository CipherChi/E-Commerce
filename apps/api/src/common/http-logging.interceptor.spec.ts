import express = require('express');
import * as request from 'supertest';
import { requestIdMiddleware } from './request-id.middleware';
import { captureRouteTemplate, requestLogger } from '../middleware/request-logger';

describe('Express request logger', () => {
  it('logs the matched route template and duration without query or body', async () => {
    const logger = { log: jest.fn() };
    const app = express();
    app.use(requestIdMiddleware, requestLogger(logger));
    app.get('/items/:id', captureRouteTemplate, (_req, res) => res.json({ ok: true }));
    await request(app).get('/items/secret?q=not-logged').expect(200);
    const entry = JSON.parse(logger.log.mock.calls[0][0]);
    expect(entry).toMatchObject({ event: 'http_request', method: 'GET', path: '/items/:id', statusCode: 200 });
    expect(entry.path).not.toContain('secret');
  });
});
