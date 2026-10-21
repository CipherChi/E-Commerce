import 'reflect-metadata';
import { createApp } from './app';
import { loadExpressEnvironment } from './config/express-env';
import { createContainer } from './lib/container';
import { closeRateLimitClients } from './middleware/rate-limit';

async function start() {
  const config = loadExpressEnvironment();
  const container = createContainer(process.env);
  const { prisma } = container;
  await prisma.$connect();
  const app = createApp({ dependencies: container });
  const server = app.listen(Number(config.API_PORT ?? 3001));
  const shutdown = () => server.close(() => { void Promise.all([prisma.$disconnect(), closeRateLimitClients()]).finally(() => process.exit(0)); });
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

void start();
