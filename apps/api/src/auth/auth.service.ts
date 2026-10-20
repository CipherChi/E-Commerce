import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash = argon2.hash('invalid-account-password-placeholder');
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new ConflictException('Email already registered');
    const user = await this.prisma.user.create({
      data: { email, name: dto.name, passwordHash: await argon2.hash(dto.password) },
    });
    return this.issueTokens(user);
  }

  async login(dto: LoginDto, clientIp = 'unknown') {
    const normalizedEmail = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    const now = Date.now();
    const key = createHash('sha256').update(`login-ip\0${user?.id ?? normalizedEmail}\0${clientIp}`).digest('hex');
    // Email identity provides a second counter shared across client IPs; only its hash is stored.
    const accountKey = createHash('sha256').update(`login-account\0${normalizedEmail}`).digest('hex');
    const [attempt, accountAttempt] = await Promise.all([
      this.prisma.loginAttempt.findUnique({ where: { key } }),
      this.prisma.loginAttempt.findUnique({ where: { key: accountKey } }),
    ]);
    const locked = [attempt, accountAttempt].some(
      (entry) => Boolean(entry?.lockedUntil && entry.lockedUntil.getTime() > now),
    );
    const passwordMatches = await argon2.verify(
      user && !locked ? user.passwordHash : await this.dummyPasswordHash,
      dto.password,
    );
    if (!user || !user.isActive || locked || !passwordMatches) {
      if ((!user || user.isActive) && !locked) {
        await Promise.all([
          this.recordLoginFailure(key, 5, 900_000),
          // Across-IP backoff starts at 10 failures and never exceeds one minute.
          this.recordLoginFailure(accountKey, 10, 60_000),
        ]);
      }
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.prisma.loginAttempt.deleteMany({ where: { key: { in: [key, accountKey] } } });
    return this.issueTokens(user);
  }

  private recordLoginFailure(key: string, threshold: number, maxLockMs: number) {
    return this.prisma.$executeRaw`
          INSERT INTO "LoginAttempt" ("key", "failedAttempts", "firstFailureAt", "lockedUntil", "updatedAt")
          VALUES (${key}, 1, NOW(), NULL, NOW())
          ON CONFLICT ("key") DO UPDATE SET
            "failedAttempts" = CASE
              WHEN "LoginAttempt"."firstFailureAt" < NOW() - INTERVAL '15 minutes' THEN 1
              ELSE "LoginAttempt"."failedAttempts" + 1
            END,
            "firstFailureAt" = CASE
              WHEN "LoginAttempt"."firstFailureAt" < NOW() - INTERVAL '15 minutes' THEN NOW()
              ELSE "LoginAttempt"."firstFailureAt"
            END,
            "lockedUntil" = CASE
              WHEN "LoginAttempt"."firstFailureAt" < NOW() - INTERVAL '15 minutes' THEN NULL
              WHEN "LoginAttempt"."failedAttempts" + 1 < ${threshold} THEN NULL
              ELSE NOW() + (
                LEAST(${maxLockMs}::double precision, 1000 * POWER(2, LEAST("LoginAttempt"."failedAttempts" + 1 - ${threshold}, 12)))
                * INTERVAL '1 millisecond'
              )
            END,
            "updatedAt" = NOW()
        `;
  }

  async refresh(userId: string, token: string) {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.sub !== userId) throw new UnauthorizedException('Invalid refresh token');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user?.isActive ||
      (payload as { tokenVersion?: number }).tokenVersion !== (user.tokenVersion ?? 0) ||
      !user.refreshTokenHash ||
      !(await argon2.verify(user.refreshTokenHash, token))
    )
      throw new UnauthorizedException('Invalid refresh token');
    return this.issueTokens(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        email: true,
        name: true,
        propertyId: true,
        memberships: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { businessId: true, role: true, business: { select: { name: true } } },
        },
      },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    const { memberships = [], ...profile } = user;
    return {
      ...profile,
      // Expose the same membership role used by API authorization, never User.role.
      role: memberships[0]?.role ?? null,
      business: memberships[0]?.business ?? null,
      businessId: memberships[0]?.businessId ?? null,
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null, tokenVersion: { increment: 1 } },
    });
    return { success: true };
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tokenVersion?: number;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
      jti: randomUUID(),
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await argon2.hash(refreshToken) },
    });
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}
