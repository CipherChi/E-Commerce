import express = require('express');
import * as request from 'supertest';
import { errorHandler } from './error-handler';
import { notFound } from './not-found';

describe('Express error monitoring hook', () => {
  const priorDsn = process.env.SENTRY_DSN;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (priorDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = priorDsn;
    global.fetch = originalFetch;
  });

  it('sends only a sanitized generic server event when SENTRY_DSN is configured', async () => {
    process.env.SENTRY_DSN = 'https://public-key@sentry.example/42';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as typeof fetch;
    const app = express();
    app.use(express.json());
    app.post('/failure', (req, _res, next) => next(new Error(`private body ${req.body.secret}`)));
    app.use(errorHandler({ error: jest.fn() }));

    await request(app)
      .post('/failure?access_token=query-secret')
      .set('Cookie', 'refresh_token=cookie-secret')
      .set('Authorization', 'Bearer header-secret')
      .send({ secret: 'body-secret' })
      .expect(500);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sentry.example/api/42/envelope/');
    const envelope = String(init.body);
    expect(envelope).toContain('Unhandled server error');
    for (const secret of ['query-secret', 'cookie-secret', 'header-secret', 'body-secret', 'private body']) {
      expect(envelope).not.toContain(secret);
    }
  });

  it('does not contact monitoring when SENTRY_DSN is unset', async () => {
    delete process.env.SENTRY_DSN;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const app = express();
    app.get('/failure', (_req, _res, next) => next(new Error('failure')));
    app.use(errorHandler({ error: jest.fn() }));

    await request(app).get('/failure').expect(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not reflect query strings in error response paths', async () => {
    const app = express();
    app.use(notFound);
    app.use(errorHandler({ error: jest.fn() }));
    const response = await request(app).get('/failure?token=query-secret').expect(404);
    expect(response.body.path).toBe('/failure');
    expect(response.body.message.message).toBe('Cannot GET /failure');
    expect(JSON.stringify(response.body)).not.toContain('query-secret');
  });
});
