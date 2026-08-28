import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, defer, delay, throwError } from 'rxjs';
import { DemoBackendService, DemoHttpError } from './demo-backend.service';
import { DemoModeService } from './demo-mode.service';

/** Small artificial latency so optimistic UI and loading states stay observable. */
const DEMO_LATENCY_MS = 90;

/**
 * Serves every `/api/**` call from the in-memory demo backend while demo mode is on.
 * It sits before the auth interceptor and never forwards the request, so no network
 * traffic — and therefore no real wedding data — is ever involved.
 */
export const demoInterceptor: HttpInterceptorFn = (request, next) => {
  const demo = inject(DemoModeService);
  const backend = inject(DemoBackendService);
  if (!demo.active() || !request.url.startsWith('/api/')) return next(request);

  const path = request.url.split('?')[0];
  return defer((): Observable<HttpResponse<unknown>> => {
    try {
      const body = backend.handle(request.method, path, request.body);
      return new Observable(subscriber => {
        subscriber.next(new HttpResponse({ body, status: 200, url: request.url }));
        subscriber.complete();
      });
    } catch (error: unknown) {
      const failure = error instanceof DemoHttpError ? error : new DemoHttpError(500, 'Erreur du mode démonstration.');
      return throwError(() => new HttpErrorResponse({
        status: failure.status,
        statusText: failure.message,
        url: request.url,
        error: { message: failure.message },
      }));
    }
  }).pipe(delay(DEMO_LATENCY_MS));
};
