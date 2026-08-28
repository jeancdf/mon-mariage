import { Injectable, inject, signal } from '@angular/core';
import { DemoBackendService } from './demo-backend.service';

const DEMO_STORAGE_KEY = 'wedding-demo-mode';

const readStoredFlag = (): boolean => {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(DEMO_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
};

/**
 * Demo mode replaces the whole API with an in-browser fake dataset so the app can
 * be explored — and edited — without a server and without ever touching the real
 * wedding data. The flag lives in sessionStorage so a page reload keeps the demo
 * running, while closing the tab ends it.
 */
@Injectable({ providedIn: 'root' })
export class DemoModeService {
  private readonly backend = inject(DemoBackendService);
  readonly active = signal(readStoredFlag());

  activate(): void {
    this.backend.reset();
    this.active.set(true);
    this.persist('on');
  }

  deactivate(): void {
    this.active.set(false);
    this.persist(null);
    this.backend.reset();
  }

  private persist(value: string | null): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      if (value) sessionStorage.setItem(DEMO_STORAGE_KEY, value);
      else sessionStorage.removeItem(DEMO_STORAGE_KEY);
    } catch {
      // Demo persistence is best effort: the flag stays in memory for this page.
    }
  }
}
