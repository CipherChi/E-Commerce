import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { asyncHandler } from '../lib/async-handler';
import { authenticate, requireOrigin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema } from '../validation/auth.schemas';
import { rateLimit } from '../middleware/rate-limit';
import { JwtPort } from '../lib/jwt';

const cookieName = 'staywise_rt';
const cookieMaxAge = 7 * 24 * 60 * 60 * 1000;
function cookieOptions(maxAge = true) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/auth', ...(maxAge ? { maxAge: cookieMaxAge } : {}) };
}

export function createAuthRouter(auth: AuthService, jwt: JwtPort, prisma: PrismaClient, accessSecret: string, webOrigin: string, redisUrl?: string): Router {
  const router = Router();
  router.post('/register', rateLimit(5, 60_000, redisUrl, 'auth:register'), validateBody(registerSchema), asyncHandler(async (req, res) => {
    const session = await auth.register(req.validatedBody as never);
    res.cookie(cookieName, session.refreshToken, cookieOptions());
    res.status(201).json({ accessToken: session.accessToken });
  }));
  router.post('/login', rateLimit(5, 60_000, redisUrl, 'auth:login'), validateBody(loginSchema), asyncHandler(async (req, res) => {
    const session = await auth.login(req.validatedBody as never, req.ip ?? 'unknown');
    res.cookie(cookieName, session.refreshToken, cookieOptions());
    res.status(201).json({ accessToken: session.accessToken });
  }));
  router.post('/refresh', requireOrigin(webOrigin), rateLimit(5, 60_000, redisUrl, 'auth:refresh'), asyncHandler(async (req, res) => {
    const token = req.cookies?.[cookieName];
    try {
      if (!token) throw new Error('Invalid refresh token');
      const [, tokenPayload] = token.split('.');
      const userId = tokenPayload ? JSON.parse(Buffer.from(tokenPayload, 'base64url').toString()).sub : '';
      const session = await auth.refresh(userId, token);
      res.cookie(cookieName, session.refreshToken, cookieOptions());
      res.status(201).json({ accessToken: session.accessToken });
    } catch {
      res.clearCookie(cookieName, cookieOptions(false));
      const error = Object.assign(new Error('Invalid refresh token'), { statusCode: 401, response: { statusCode: 401, message: 'Invalid refresh token' } });
      throw error;
    }
  }));
  router.get('/me', authenticate(jwt, prisma, accessSecret), asyncHandler(async (req, res) => {
    const user = (req as typeof req & { user: { sub: string } }).user;
    res.json(await auth.me(user.sub));
  }));
  router.post('/logout', authenticate(jwt, prisma, accessSecret), requireOrigin(webOrigin), asyncHandler(async (req, res) => {
    const user = (req as typeof req & { user: { sub: string } }).user;
    await auth.logout(user.sub);
    res.clearCookie(cookieName, cookieOptions(false));
    res.status(204).end();
  }));
  return router;
}
