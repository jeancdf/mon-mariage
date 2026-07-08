import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Guest, GuestCategory, Rsvp } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { CATS, EVENT_LABELS, RSVP_LABELS, gid } from '../../data/seed';
import { BadgeComponent } from '../../shared/badge.component';
import { IconComponent } from '../../shared/icon.component';
import { CATEGORY_OPTIONS } from '../../shared/wedding-utils';
import { GuestModalComponent } from './guest-modal.component';
import { parseGuestWorkbook } from './guest-import';
import { GuestApiService } from '../../data/guest-api.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ToastService } from '../../shared/toast.service';

@Component({
  selector: 'app-guests',
  standalone: true,
  imports: [FormsModule, BadgeComponent, IconComponent, GuestModalComponent, ConfirmDialogComponent],
  templateUrl: './guests.component.html',
})
export class GuestsComponent {
  readonly store = inject(WeddingStore);
  private readonly guestApi = inject(GuestApiService);
  private readonly toast = inject(ToastService);
  readonly importInput = viewChild<ElementRef<HTMLInputElement>>('importInput');
  readonly categoryOptions = CATEGORY_OPTIONS;
  readonly cats = CATS;
  readonly rsvpLabels = RSVP_LABELS;
  readonly eventLabels = EVENT_LABELS;

  readonly search = signal('');
  readonly categoryFilter = signal<GuestCategory | 'all'>('all');
  readonly rsvpFilter = signal<Rsvp | 'all'>('all');
  editingGuest: Guest | null = null;
  isAdding = false;
  importError = '';
  importMessage = '';
  isImporting = false;
  guestPendingDeletion: Guest | null = null;

  readonly filteredGuests = computed(() => {
    const query = this.search().trim().toLowerCase();
    const cat = this.categoryFilter();
    const rsvp = this.rsvpFilter();
    return this.store.guests().filter(guest => {
      if (cat !== 'all' && guest.category !== cat) return false;
      if (rsvp !== 'all' && guest.rsvp !== rsvp) return false;
      const searchableName = `${guest.firstName} ${guest.lastName} ${guest.plusOneName}`.toLowerCase();
      return !query || searchableName.includes(query);
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

  async saveGuest(guest: Guest): Promise<void> {
    try {
      if (this.editingGuest) {
        const savedGuest = await this.guestApi.updateGuest(guest);
        this.store.updateGuest(savedGuest);
      } else {
        const savedGuest = await this.guestApi.createGuest({ ...guest, id: guest.id || gid() });
        this.store.addGuest(savedGuest);
      }
      this.closeModal();
    } catch {
      this.toast.error("Impossible d'enregistrer l'invité.");
    }
  }

  requestDeleteGuest(guest: Guest): void {
    this.guestPendingDeletion = guest;
  }

  cancelDeleteGuest(): void {
    this.guestPendingDeletion = null;
  }

  async confirmDeleteGuest(): Promise<void> {
    const guest = this.guestPendingDeletion;
    if (!guest) return;
    this.guestPendingDeletion = null;
    await this.deleteGuest(guest.id);
  }

  private async deleteGuest(id: string): Promise<void> {
    try {
      await this.guestApi.deleteGuest(id);
      this.store.deleteGuest(id);
    } catch {
      this.toast.error("Impossible de supprimer l'invité.");
    }
  }

  openImportPicker(): void {
    this.importInput()?.nativeElement.click();
  }

  async onImportGuests(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.importError = '';
    this.importMessage = '';

    if (!file) return;

    this.isImporting = true;

    try {
      const importResult = await parseGuestWorkbook(file);
      if (!importResult.guests.length) {
        this.importError = 'Aucun invité valide trouvé dans les 2 premières feuilles.';
        return;
      }

      const savedGuests = await this.guestApi.replaceGuests(importResult.guests);
      this.store.replaceGuests(savedGuests);
      this.importMessage = `${savedGuests.length} invités importés`;
      if (importResult.skippedRows) {
        this.importMessage += ` (${importResult.skippedRows} lignes ignorées)`;
      }
    } catch {
      this.importError = 'Import impossible. Vérifiez le fichier et l’API.';
    } finally {
      this.isImporting = false;
    }
  }
}
