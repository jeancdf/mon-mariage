import { Component, Input } from '@angular/core';
import { IconName } from './wedding-utils';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      @switch (name) {
        @case ('dashboard') {
          <rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.2" />
          <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.2" />
          <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.2" />
          <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.2" />
        }
        @case ('guests') {
          <circle cx="5.5" cy="4.5" r="2.2" stroke="currentColor" stroke-width="1.2" />
          <path d="M1 13c0-2.5 2.02-4.5 4.5-4.5S10 10.5 10 13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          <circle cx="11.5" cy="5.5" r="1.6" stroke="currentColor" stroke-width="1.2" />
          <path d="M11.5 9.5c1.66 0 3 1.12 3 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        }
        @case ('housing') {
          <path d="M1.5 6.5L7.5 2l6 4.5V13a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V6.5z" stroke="currentColor" stroke-width="1.2" />
          <path d="M5.5 13.5V9h4v4.5" stroke="currentColor" stroke-width="1.2" />
        }
        @case ('seating') {
          <rect x="2.5" y="5.5" width="10" height="4" rx="1" stroke="currentColor" stroke-width="1.2" />
          <path d="M4.5 5.5V3.5M10.5 5.5V3.5M1 8h1.5M13.5 8H15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        }
        @case ('budget') {
          <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" stroke-width="1.2" />
          <path d="M7.5 4v1.2M7.5 9.8V11M5.5 6.1c0-.77.9-1.4 2-1.4s2 .63 2 1.4c0 1.4-4 1.4-4 2.8 0 .77.9 1.4 2 1.4s2-.63 2-1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        }
        @case ('todo') {
          <rect x="1" y="1" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.2" />
          <path d="M4 7.5l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
        }
        @case ('vendors') {
          <rect x="1.5" y="4.5" width="12" height="9" rx="1" stroke="currentColor" stroke-width="1.2" />
          <path d="M5.5 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" stroke="currentColor" stroke-width="1.2" />
          <path d="M1.5 8.5h12" stroke="currentColor" stroke-width="1.2" />
        }
        @case ('plus') {
          <path d="M7.5 2.5v10M2.5 7.5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        }
        @case ('x') {
          <path d="M3 3l9 9M12 3l-9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        }
        @case ('edit') {
          <path d="M9 2.5l2.5 2.5-7 7H2V9.5l7-7z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
        }
        @case ('trash') {
          <path d="M2 4h11M5 4V2.5h5V4M4.5 4l.6 8h4.8l.6-8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        }
        @case ('bed') {
          <path d="M1 9V5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v4" stroke="currentColor" stroke-width="1.2" />
          <path d="M1 11v-2h13v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          <rect x="4" y="5.5" width="7" height="2" rx="0.5" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="0.8" />
        }
        @case ('chevron') {
          <path d="M3 5l4.5 4L12 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        }
        @case ('check') {
          <path d="M2.5 7.5l3.5 3.5 6-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        }
      }
    </svg>
  `,
  styles: [':host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }'],
})
export class IconComponent {
  @Input() name: IconName = 'plus';
  @Input() size = 15;
}
