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
    const [membership, user] = await Promise.all([
      this.prisma.businessMember.findFirst({
        where: { userId: payload.sub },
        orderBy: { createdAt: 'desc' },
        select: { businessId: true, role: true },
      }),
      this.prisma.user.findUnique({ where: { id: payload.sub }, select: { tokenVersion: true } }),
    ]);
    if (!user || (payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Session has ended');
    }
    return {
      ...payload,
      role: membership?.role === 'OWNER' ? 'ADMIN' : payload.role,
      businessId: membership?.businessId,
    };
  }
}
