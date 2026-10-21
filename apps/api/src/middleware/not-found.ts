import { NextFunction, Request, Response } from 'express';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  const error = new Error(`Cannot ${req.method} ${req.originalUrl}`) as Error & { statusCode: number; response: unknown };
  error.statusCode = 404;
  error.response = { message: error.message, error: 'Not Found', statusCode: 404 };
  next(error);
}
