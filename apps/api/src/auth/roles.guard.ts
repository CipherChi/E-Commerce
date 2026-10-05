import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const memberRole = context.switchToHttp().getRequest().user?.role;
    // Existing @Roles('ADMIN') declarations mean business OWNER; user-level ADMIN is ignored by JwtStrategy.
    return roles.some((role) =>
      role === 'ADMIN' ? memberRole === 'OWNER' : role === memberRole,
    );
  }
}
