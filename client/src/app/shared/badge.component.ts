import { Component, Input } from '@angular/core';
import { GuestCategory, Rsvp } from '../data/types';

@Component({
  selector: 'app-badge',
  standalone: true,
  template: `
    <span
      class="badge"
      [class.confirmed]="variant === 'confirmed'"
      [class.pending]="variant === 'pending'"
      [class.declined]="variant === 'declined'"
      [attr.data-cat]="category || null">
      <ng-content />
    </span>
  `,
})
export class BadgeComponent {
  @Input() variant: Rsvp | 'default' = 'default';
  @Input() category: GuestCategory | null = null;
}
