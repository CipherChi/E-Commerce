import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard', () => {
  it.each([
    ['OWNER', true],
    ['MANAGER', false],
    ['STAFF', false],
    ['ADMIN', false],
  ])('evaluates @Roles(ADMIN) from the business-member role %s', (role, allowed) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context: any = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    };
    expect(guard.canActivate(context)).toBe(allowed);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });
});
