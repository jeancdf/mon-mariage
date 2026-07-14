import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CsrfStateService {
  readonly token = signal('');
}

