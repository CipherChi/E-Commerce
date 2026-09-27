import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class BusinessContextGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: { businessId?: string } }>();
    if (!request.user?.businessId) throw new ForbiddenException('Create or join a business first');
    return true;
  }
}
