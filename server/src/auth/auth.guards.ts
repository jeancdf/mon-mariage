import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountsService } from './accounts.service';
import { ORGANIZER_ONLY_KEY, PERMISSION_KEY, PUBLIC_ROUTE_KEY } from './auth.decorators';
import type { AuthenticatedRequest, PermissionLevel, SectionKey } from './auth.types';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accountsService: AccountsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await this.accountsService.resolveSession(String(request.headers.cookie ?? ''));
    if (!session || session.account.status !== 'active') {
      throw new UnauthorizedException('Authentification requise.');
    }
    request.session = session;
    request.account = session.account;
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? false;
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly accountsService: AccountsService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const csrfToken = request.headers['x-csrf-token'];
    if (typeof csrfToken !== 'string' || !this.accountsService.verifyCsrfToken(request.session, csrfToken)) {
      throw new ForbiddenException('Jeton CSRF invalide.');
    }
    return true;
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const organizerOnly = this.reflector.getAllAndOverride<boolean>(ORGANIZER_ONLY_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (organizerOnly) {
      if (!request.account.isOrganizer) throw new ForbiddenException('Administration réservée aux organisateurs.');
      return true;
    }
    const required = this.reflector.getAllAndOverride<{ section: SectionKey; level: PermissionLevel }>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;
    if (request.account.isOrganizer) return true;
    const permission = request.account.profile?.permissions?.find(item => item.section === required.section);
    const allowed = required.level === 'edit' ? permission?.canEdit : permission?.canView;
    if (!allowed) throw new ForbiddenException('Vous ne disposez pas de ce droit.');
    return true;
  }
}
