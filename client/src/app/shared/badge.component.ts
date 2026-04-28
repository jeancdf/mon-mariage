import { Component, Input } from '@angular/core';
import { Rsvp } from '../data/types';

@Component({
  selector: 'app-badge',
  standalone: true,
  template: `
    <span
      class="badge"
      [class.confirmed]="variant === 'confirmed'"
      [class.pending]="variant === 'pending'"
      [class.declined]="variant === 'declined'">
      <ng-content />
    </span>
  `,
})
export class BadgeComponent {
  @Input() variant: Rsvp | 'default' = 'default';
}
