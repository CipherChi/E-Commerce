import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow('JWT_ACCESS_SECRET'),
    });
  }
  async validate(payload: { sub: string; email: string; role: string; tokenVersion?: number }) {
    const [membership, anyMembership, user] = await Promise.all([
      this.prisma.businessMember.findFirst({
        where: { userId: payload.sub, isActive: true },
        orderBy: { createdAt: 'desc' },
        select: { businessId: true, role: true },
      }),
      this.prisma.businessMember.findFirst({
        where: { userId: payload.sub },
        select: { id: true },
      }),
      this.prisma.user.findUnique({ where: { id: payload.sub }, select: { tokenVersion: true, isActive: true } }),
    ]);
    if (!user || !user.isActive || (payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Session has ended');
    }
    if (!membership && anyMembership) throw new UnauthorizedException('Session has ended');
    return {
      ...payload,
      // Tenant authorization always follows this user's membership in the selected business.
      role: membership?.role ?? null,
      businessId: membership?.businessId,
    };
  }
}
