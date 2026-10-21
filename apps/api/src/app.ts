import cookieParser = require('cookie-parser');
import express = require('express');
import { Express } from 'express';
import helmet from 'helmet';
import { loadExpressEnvironment } from './config/express-env';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { requestIdMiddleware } from './common/request-id.middleware';
import { requestLogger } from './middleware/request-logger';
import { trustProxySetting } from './config/trust-proxy';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { createAuthRouter } from './routes/auth.routes';
import { mountApiRoutes } from './routes/api.routes';
import { ApiContainer } from './lib/container';

export interface AppOptions {
  environment?: NodeJS.ProcessEnv;
  logger?: Pick<Console, 'log' | 'error'>;
  dependencies?: ApiContainer;
}

export function createApp(options: AppOptions = {}): Express {
  const config = loadExpressEnvironment(options.environment);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxySetting(config.TRUST_PROXY));
  app.use(helmet());
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || origin === config.WEB_ORIGIN) {
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
      res.vary('Origin');
    }
    if (req.method === 'OPTIONS') {
      if (origin === config.WEB_ORIGIN) {
        res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
        const requestedHeaders = req.headers['access-control-request-headers'];
        if (requestedHeaders) res.setHeader('Access-Control-Allow-Headers', requestedHeaders);
      }
      return res.status(204).end();
    }
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use(requestLogger(options.logger));

  if (options.dependencies) {
    const { prisma, jwt, auth } = options.dependencies;
    app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
    const readiness = async (_req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', database: 'ok' });
      } catch (error) { next(error); }
    };
    app.get('/health', readiness);
    app.get('/health/ready', readiness);
    app.use('/auth', createAuthRouter(auth, jwt, prisma, config.JWT_ACCESS_SECRET, config.WEB_ORIGIN, config.REDIS_URL));
    mountApiRoutes(app, options.dependencies, config.JWT_ACCESS_SECRET, config.REDIS_URL);
  }

  // Feature routers are attached incrementally; keep this factory independent of listen().
  app.use(notFound);
  app.use(errorHandler(options.logger));
  return app;
}
