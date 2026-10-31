import * as request from 'supertest';
import { createApp } from './app';

describe('Express application factory', () => {
  const environment = {
    DATABASE_URL: 'postgresql://localhost/test',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    WEB_ORIGIN: 'http://localhost:3000',
    NODE_ENV: 'test',
  };

  it('does not bind a port and returns the shared error shape for unknown paths', async () => {
    const app = createApp({ environment, logger: { log: jest.fn(), error: jest.fn() } });
    const response = await request(app).get('/missing?query=1').expect(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      path: '/missing',
      requestId: expect.any(String),
    });
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('allows credentialed CORS only for the configured origin', async () => {
    const app = createApp({ environment, logger: { log: jest.fn(), error: jest.fn() } });
    const allowed = await request(app).options('/health/live')
      .set('Origin', environment.WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(environment.WEB_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const denied = await request(app).options('/health/live').set('Origin', 'https://evil.example').expect(204);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
