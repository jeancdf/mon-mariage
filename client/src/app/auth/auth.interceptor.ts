import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthSessionStateService } from './auth-session-state.service';
import { CsrfStateService } from './csrf-state.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const csrf = inject(CsrfStateService).token();
  const state = inject(AuthSessionStateService);
  const router = inject(Router);
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  return next(request.clone({
    withCredentials: true,
    setHeaders: mutation && csrf ? { 'X-CSRF-Token': csrf } : {},
  })).pipe(catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      state.clear();
      const publicRequest = request.url.includes('/api/public/')
        || request.url.includes('/api/health');
      const authenticationRequest = request.url.includes('/api/auth/login')
        || request.url.includes('/api/auth/invitation/')
        || request.url.includes('/api/auth/me');
      if (!authenticationRequest && !publicRequest) queueMicrotask(() => void router.navigateByUrl('/connexion'));
    }
    return throwError(() => error);
  }));
};
