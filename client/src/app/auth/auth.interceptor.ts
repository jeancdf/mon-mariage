import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CsrfStateService } from './csrf-state.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const csrf = inject(CsrfStateService).token();
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  return next(request.clone({
    withCredentials: true,
    setHeaders: mutation && csrf ? { 'X-CSRF-Token': csrf } : {},
  }));
};

