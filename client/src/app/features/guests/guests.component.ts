import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Guest, GuestCategory, Rsvp } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { CATS, EVENT_LABELS, RSVP_LABELS, gid } from '../../data/seed';
import { BadgeComponent } from '../../shared/badge.component';
import { IconComponent } from '../../shared/icon.component';
import { CATEGORY_OPTIONS, RSVP_OPTIONS } from '../../shared/wedding-utils';
import { GuestModalComponent } from './guest-modal.component';
import { parseGuestWorkbook } from './guest-import';
import { GuestApiService } from '../../data/guest-api.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ToastService } from '../../shared/toast.service';

type GuestSortKey = 'name' | 'category' | 'rsvp';
type SortDir = 'asc' | 'desc';

interface ExcelWriter {
  utils: {
    json_to_sheet: (rows: Record<string, string>[]) => unknown;
    book_new: () => unknown;
    book_append_sheet: (workbook: unknown, sheet: unknown, name: string) => void;
  };
  writeFile: (workbook: unknown, filename: string) => void;
}

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
  readonly rsvpOptions = RSVP_OPTIONS;
  readonly cats = CATS;
  readonly rsvpLabels = RSVP_LABELS;
  readonly eventLabels = EVENT_LABELS;

  readonly search = signal('');
  readonly categoryFilter = signal<GuestCategory | 'all'>('all');
  readonly rsvpFilter = signal<Rsvp | 'all'>('all');
  readonly sortBy = signal<GuestSortKey>('name');
  readonly sortDir = signal<SortDir>('asc');
  editingGuest: Guest | null = null;
  isAdding = false;
  importError = '';
  importMessage = '';
  isImporting = false;
  isExporting = false;
  guestPendingDeletion: Guest | null = null;

  readonly filteredGuests = computed(() => {
    const query = this.search().trim().toLowerCase();
    const cat = this.categoryFilter();
    const rsvp = this.rsvpFilter();
    const sortBy = this.sortBy();
    const direction = this.sortDir() === 'asc' ? 1 : -1;
    return this.store.guests().filter(guest => {
      if (cat !== 'all' && guest.category !== cat) return false;
      if (rsvp !== 'all' && guest.rsvp !== rsvp) return false;
      const searchableName = `${guest.firstName} ${guest.lastName} ${guest.plusOneName} ${guest.dietary} ${guest.notes}`.toLowerCase();
      return !query || searchableName.includes(query);
    }).sort((a, b) => this.sortValue(a, sortBy).localeCompare(this.sortValue(b, sortBy), 'fr') * direction);
  });

  readonly filtersActive = computed(() =>
    Boolean(this.search().trim()) || this.categoryFilter() !== 'all' || this.rsvpFilter() !== 'all',
  );

  openAdd(): void {
    this.isAdding = true;
    this.editingGuest = null;
  }

  closeModal(): void {
    this.isAdding = false;
    this.editingGuest = null;
  }

  setSort(key: GuestSortKey): void {
    if (this.sortBy() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortBy.set(key);
    this.sortDir.set('asc');
  }

  sortLabel(key: GuestSortKey): string {
    if (this.sortBy() !== key) return '';
    return this.sortDir() === 'asc' ? '↑' : '↓';
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

  async exportGuests(): Promise<void> {
    this.isExporting = true;
    try {
      const XLSX = (await import('xlsx')) as ExcelWriter;
      const rows = this.store.guests().map(guest => ({
        Prénom: guest.firstName,
        Nom: guest.lastName,
        'Adresse e-mail': guest.email,
        'Rôle organisation': guest.organizationRole,
        Catégorie: this.cats[guest.category].label,
        RSVP: this.rsvpLabels[guest.rsvp],
        '+1 (nom)': guest.hasPlusOne ? guest.plusOneName : '',
        Enfants: guest.kids.map(kid => `${kid.name}${kid.age ? ` (${kid.age} ans)` : ''}`).join(', '),
        Régime: guest.dietary,
        Événements: guest.events.map(event => this.eventLabels[event]).join(', '),
        Transport: guest.transport,
        Notes: guest.notes,
      }));
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Invités');
      XLSX.writeFile(workbook, 'invites.xlsx');
    } catch {
      this.toast.error("Impossible d'exporter les invités.");
    } finally {
      this.isExporting = false;
    }
  }

  async updateRsvp(guest: Guest, rsvp: Rsvp): Promise<void> {
    if (guest.rsvp === rsvp) return;
    try {
      const savedGuest = await this.guestApi.updateGuest({ ...guest, rsvp });
      this.store.updateGuest(savedGuest);
    } catch {
      this.toast.error("Impossible de modifier le RSVP.");
    }
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

  private sortValue(guest: Guest, key: GuestSortKey): string {
    if (key === 'category') return this.cats[guest.category].label;
    if (key === 'rsvp') return this.rsvpLabels[guest.rsvp];
    return `${guest.lastName} ${guest.firstName}`.trim();
  }
}
