import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as argon2 from 'argon2';

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    email: 'guest@example.com',
    name: 'Guest',
    role: 'STAFF',
    passwordHash: 'hashed',
    refreshTokenHash: null,
  };
  const prisma: any = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
  const jwt: any = {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
    verifyAsync: jest.fn().mockResolvedValue({ sub: user.id }),
  };
  const config: any = { getOrThrow: jest.fn((key) => key) };
  let service: AuthService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma, jwt, config);
  });

  it('registers with a hashed password and returns session tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    const result = await service.register({
      email: user.email,
      name: user.name,
      password: 'password123',
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: expect.any(String) }),
      }),
    );
    expect(result.user).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    expect(result.accessToken).toBe('signed-token');
  });

  it('rejects duplicate registration', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(
      service.register({ email: user.email, name: user.name, password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid login credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    jest.spyOn(argon2, 'verify').mockResolvedValue(false);
    await expect(
      service.login({ email: user.email, password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates a valid refresh token', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, refreshTokenHash: 'stored-hash' });
    prisma.user.update.mockResolvedValue(user);
    jest.spyOn(argon2, 'verify').mockResolvedValue(true);
    jest.spyOn(argon2, 'hash').mockResolvedValue('new-hash');
    const result = await service.refresh(user.id, 'refresh-token');
    expect(result.refreshToken).toBe('signed-token');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { refreshTokenHash: 'new-hash' } }),
    );
  });
});
