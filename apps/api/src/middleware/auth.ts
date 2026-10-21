import { NextFunction, Request, RequestHandler, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../lib/async-handler';

export type AuthUser = { sub: string; email: string; role: string | null; businessId?: string; tokenVersion?: number };
type AuthRequest = Request & { user?: AuthUser };

export function authenticate(jwt: JwtService, prisma: PrismaClient, accessSecret: string): RequestHandler {
  return asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
    if (!match) return next(unauthorized());
    let payload: AuthUser;
    try { payload = await jwt.verifyAsync<AuthUser>(match[1], { secret: accessSecret }); }
    catch { return next(unauthorized()); }
    const [membership, anyMembership, user] = await Promise.all([
      prisma.businessMember.findFirst({ where: { userId: payload.sub, isActive: true }, orderBy: { createdAt: 'desc' }, select: { businessId: true, role: true } }),
      prisma.businessMember.findFirst({ where: { userId: payload.sub }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: payload.sub }, select: { tokenVersion: true, isActive: true } }),
    ]);
    if (!user?.isActive || (payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0) || (!membership && anyMembership)) return next(unauthorized('Session has ended'));
    req.user = { ...payload, role: membership?.role ?? null, businessId: membership?.businessId };
    next();
  });
}

export const requireBusinessContext: RequestHandler = (req: AuthRequest, _res, next) => {
  if (!req.user?.businessId || !req.user.role) return next(forbidden('Create or join a business first'));
  next();
};

export function requireRole(...roles: string[]): RequestHandler {
  return (req: AuthRequest, _res, next) => {
    const memberRole = req.user?.role;
    const allowed = roles.some((role) => role === 'ADMIN' ? memberRole === 'OWNER' : memberRole === role);
    next(allowed ? undefined : forbidden());
  };
}

export function requireOrigin(expectedOrigin: string): RequestHandler {
  return (req, _res, next) => next(req.headers.origin === expectedOrigin ? undefined : forbidden('Invalid request origin'));
}

function unauthorized(message = 'Unauthorized') { return Object.assign(new Error(message), { statusCode: 401, response: { statusCode: 401, message } }); }
function forbidden(message = 'Forbidden') { return Object.assign(new Error(message), { statusCode: 403, response: { statusCode: 403, message } }); }
