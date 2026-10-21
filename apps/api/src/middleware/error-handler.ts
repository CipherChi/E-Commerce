import { ErrorRequestHandler, Request, Response } from 'express';
import { ZodError } from 'zod';

type RequestWithId = Request & { requestId?: string };
type HttpErrorLike = Error & { getStatus?: () => number; getResponse?: () => unknown; status?: number; statusCode?: number; response?: unknown };

export function errorHandler(logger: Pick<Console, 'error'> = console): ErrorRequestHandler {
  return (error: HttpErrorLike, req: RequestWithId, res: Response, _next) => {
    if (res.headersSent) return;
    let status = 500;
    let message: unknown = 'Internal server error';
    if (error instanceof ZodError) {
      status = 400;
      message = error.issues.map((issue) => `${issue.path.join('.')}${issue.path.length ? ' ' : ''}${issue.message}`);
    } else if (typeof error.getStatus === 'function') {
      status = error.getStatus();
      message = typeof error.getResponse === 'function' ? error.getResponse() : error.message;
    } else if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600) {
      status = error.statusCode;
      message = error.response ?? error.message ?? message;
    }

    if (status >= 500) {
      logger.error(JSON.stringify({ event: 'http_exception', requestId: req.requestId ?? null, method: req.method, path: req.originalUrl, statusCode: status }));
    }
    res.status(status).json({
      statusCode: status,
      message,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      requestId: req.requestId ?? null,
    });
  };
}
