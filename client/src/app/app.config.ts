import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { demoInterceptor } from './demo/demo.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // demoInterceptor runs first: while demo mode is on it answers every /api call
    // locally and never forwards it to the network.
    provideHttpClient(withInterceptors([demoInterceptor, authInterceptor])),
    provideRouter(routes),
  ]
};
