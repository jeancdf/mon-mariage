import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Guest, GuestCategory, Rsvp } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { CATS, EVENT_LABELS, RSVP_LABELS, gid } from '../../data/seed';
import { BadgeComponent } from '../../shared/badge.component';
import { IconComponent } from '../../shared/icon.component';
import { CATEGORY_OPTIONS } from '../../shared/wedding-utils';
import { GuestModalComponent } from './guest-modal.component';

@Component({
  selector: 'app-guests',
  standalone: true,
  imports: [FormsModule, BadgeComponent, IconComponent, GuestModalComponent],
  templateUrl: './guests.component.html',
})
export class GuestsComponent {
  readonly store = inject(WeddingStore);
  readonly categoryOptions = CATEGORY_OPTIONS;
  readonly cats = CATS;
  readonly rsvpLabels = RSVP_LABELS;
  readonly eventLabels = EVENT_LABELS;

  search = '';
  categoryFilter: GuestCategory | 'all' = 'all';
  rsvpFilter: Rsvp | 'all' = 'all';
  editingGuest: Guest | null = null;
  isAdding = false;

  readonly filteredGuests = computed(() => {
    const query = this.search.trim().toLowerCase();
    return this.store.guests().filter(guest => {
      if (this.categoryFilter !== 'all' && guest.category !== this.categoryFilter) return false;
      if (this.rsvpFilter !== 'all' && guest.rsvp !== this.rsvpFilter) return false;
      return !query || `${guest.firstName} ${guest.lastName}`.toLowerCase().includes(query);
    });
  });

  openAdd(): void {
    this.isAdding = true;
    this.editingGuest = null;
  }

  closeModal(): void {
    this.isAdding = false;
    this.editingGuest = null;
  }

  saveGuest(guest: Guest): void {
    if (this.editingGuest) {
      this.store.updateGuest(guest);
    } else {
      this.store.addGuest({ ...guest, id: guest.id || gid() });
    }
    this.closeModal();
  }
}
