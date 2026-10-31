import { ErrorRequestHandler, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ZodError } from 'zod';

type RequestWithId = Request & { requestId?: string; requestLogPath?: string };
type HttpErrorLike = Error & { getStatus?: () => number; getResponse?: () => unknown; status?: number; statusCode?: number; response?: unknown };

async function sendSanitizedMonitoringEvent(dsn: string, errorName: string, requestId: string | null) {
  const parsed = new URL(dsn);
  const projectId = parsed.pathname.split('/').filter(Boolean).pop();
  if (!projectId || !['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid Sentry DSN');
  const prefix = parsed.pathname.split('/').filter(Boolean).slice(0, -1).join('/');
  const endpoint = `${parsed.origin}${prefix ? `/${prefix}` : ''}/api/${projectId}/envelope/`;
  const eventId = randomUUID().replace(/-/g, '');
  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify({
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: 'node',
      level: 'error',
      logger: 'express.error-handler',
      tags: requestId ? { request_id: requestId } : {},
      exception: { values: [{ type: /^[A-Za-z][A-Za-z0-9_.]{0,99}$/.test(errorName) ? errorName : 'Error', value: 'Unhandled server error' }] },
    }),
  ].join('\n');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-sentry-envelope' },
    body: envelope,
  });
  if (!response.ok) throw new Error(`Monitoring endpoint returned ${response.status}`);
}

export function errorHandler(logger: Pick<Console, 'error'> = console): ErrorRequestHandler {
  return (error: HttpErrorLike, req: RequestWithId, res: Response, _next) => {
    if (res.headersSent) return;
    let status = 500;
    let message: unknown = 'Internal server error';
    if (error instanceof ZodError) {
      status = 400;
      message = {
        statusCode: 400,
        message: error.issues.flatMap((issue) => issue.code === 'unrecognized_keys'
          ? issue.keys.map((key) => `property ${key} should not exist`)
          : [`${issue.path.join('.')}${issue.path.length ? ' ' : ''}${issue.message}`]),
        error: 'Bad Request',
      };
    } else if (typeof error.getStatus === 'function') {
      status = error.getStatus();
      message = typeof error.getResponse === 'function' ? error.getResponse() : error.message;
    } else if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600) {
      status = error.statusCode;
      message = status >= 500 ? 'Internal server error' : error.response ?? error.message ?? message;
    }

    if (status >= 500) {
      const errorCode = (error as HttpErrorLike & { code?: string }).code;
      logger.error(JSON.stringify({ event: 'http_exception', requestId: req.requestId ?? null, method: req.method, path: req.requestLogPath ?? 'unmatched', statusCode: status, errorName: error.name, ...(errorCode ? { errorCode } : {}) }));
      const dsn = process.env.SENTRY_DSN?.trim();
      if (dsn) {
        void sendSanitizedMonitoringEvent(dsn, error.name, req.requestId ?? null).catch(() => {
          logger.error(JSON.stringify({ event: 'error_monitoring_failed', requestId: req.requestId ?? null }));
        });
      }
    }
    res.status(status).json({
      statusCode: status,
      message,
      path: req.requestLogPath ?? (req.route ? `${req.baseUrl}${req.route.path}` : req.path),
      timestamp: new Date().toISOString(),
      requestId: req.requestId ?? null,
    });
  };
}
