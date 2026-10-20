import { createHash, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function swaggerBasicAuth(username?: string, password?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!username || !password) return res.sendStatus(503);
    const authorization = req.headers.authorization ?? '';
    const candidate = authorization.startsWith('Basic ')
      ? Buffer.from(authorization.slice(6), 'base64').toString()
      : '';
    const actual = createHash('sha256').update(candidate).digest();
    const expected = createHash('sha256').update(`${username}:${password}`).digest();
    if (!timingSafeEqual(actual, expected)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="API documentation"');
      return res.sendStatus(401);
    }
    return next();
  };
}
