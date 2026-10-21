import { NextFunction, Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string; route?: { path?: string | RegExp } };

export function requestLogger(logger: Pick<Console, 'log'> = console) {
  return (req: RequestWithId, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    res.once('finish', () => {
      const routePath = typeof req.route?.path === 'string' ? `${req.baseUrl}${req.route.path}` : 'unmatched';
      logger.log(JSON.stringify({ event: 'http_request', requestId: req.requestId ?? null, method: req.method, path: routePath, statusCode: res.statusCode, durationMs: Date.now() - startedAt }));
    });
    next();
  };
}
