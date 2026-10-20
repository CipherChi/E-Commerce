import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

type RequestWithId = Request & { requestId?: string };

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  (req as RequestWithId).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
