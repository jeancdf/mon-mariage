import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { SectionKey } from './auth.types';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.initialize();
  return auth.authenticated()
    ? true
    : router.createUrlTree(['/connexion'], { queryParams: { returnUrl: state.url } });
};

export const permissionGuard: CanActivateFn = async route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.initialize();
  const section = route.data['section'] as SectionKey;
  if (auth.can(section)) return true;
  if (auth.can('final_weeks')) return router.createUrlTree(['/dernieres-semaines']);
  if (auth.can('dashboard')) return router.createUrlTree(['/dashboard']);
  return router.createUrlTree(['/connexion']);
};

export const organizerGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.initialize();
  return auth.isOrganizer() ? true : router.createUrlTree(['/dernieres-semaines']);
};

