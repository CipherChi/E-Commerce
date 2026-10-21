import 'reflect-metadata';
import { createApp } from './app';
import { loadExpressEnvironment } from './config/express-env';

async function start() {
  const config = loadExpressEnvironment();
  const app = createApp();
  const server = app.listen(Number(config.API_PORT ?? 3001));
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

void start();
