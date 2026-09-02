import { Component, inject } from '@angular/core';
import { PublicThemeService } from './public-theme.service';

@Component({
  selector: 'app-public-theme-toggle',
  standalone: true,
  styles: [':host { display: contents; }'],
  template: `
    <button
      type="button"
      class="public-theme-toggle"
      [attr.aria-label]="theme.toggleLabel()"
      (click)="theme.toggle()"
    >
      @if (theme.isDark()) {
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6" />
          <path
            d="M12 3v1.6M12 19.4V21M4.93 4.93l1.13 1.13M17.94 17.94l1.13 1.13M3 12h1.6M19.4 12H21M4.93 19.07l1.13-1.13M17.94 6.06l1.13-1.13"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path
            d="M19 14.5A7.5 7.5 0 1 1 9.5 5 6 6 0 0 0 19 14.5z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </svg>
      }
    </button>
  `,
})
export class PublicThemeToggleComponent {
  readonly theme = inject(PublicThemeService);
}
