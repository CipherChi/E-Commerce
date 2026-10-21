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

export interface AppOptions {
  environment?: NodeJS.ProcessEnv;
  logger?: Pick<Console, 'log' | 'error'>;
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

  // Feature routers are attached incrementally; keep this factory independent of listen().
  app.use(notFound);
  app.use(errorHandler(options.logger));
  return app;
}
