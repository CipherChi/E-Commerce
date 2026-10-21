import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodType } from 'zod';

declare global {
  namespace Express {
    interface Request { validatedBody?: unknown; validatedQuery?: unknown; }
  }
}

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.validatedBody = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    req.validatedQuery = result.data;
    next();
  };
}
