import 'reflect-metadata';
import { createApp } from './app';
import { loadExpressEnvironment } from './config/express-env';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth/auth.service';
import { closeRateLimitClients } from './middleware/rate-limit';

async function start() {
  const config = loadExpressEnvironment();
  const prisma = new PrismaClient();
  await prisma.$connect();
  const jwt = new JwtService();
  const auth = new AuthService(prisma as never, jwt, { getOrThrow: (key: string) => config[key as keyof typeof config] } as never);
  const app = createApp({ dependencies: { prisma, jwt, auth } });
  const server = app.listen(Number(config.API_PORT ?? 3001));
  const shutdown = () => server.close(() => { void Promise.all([prisma.$disconnect(), closeRateLimitClients()]).finally(() => process.exit(0)); });
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

void start();
