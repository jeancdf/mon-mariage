import { ChangeDetectorRef, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Guest, GuestCategory, Rsvp } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { CATS, EVENT_LABELS, RSVP_LABELS, gid } from '../../data/seed';
import { BadgeComponent } from '../../shared/badge.component';
import { IconComponent } from '../../shared/icon.component';
import { CATEGORY_OPTIONS, RSVP_OPTIONS, guestPeople } from '../../shared/wedding-utils';
import { GuestModalComponent } from './guest-modal.component';
import { exportGuestRows, importPayload, ImportPreviewRow, parseGuestWorkbook, previewGuestImport } from './guest-import';
import { apiError } from '../../shared/api-error';
import { GuestApiService } from '../../data/guest-api.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ToastService } from '../../shared/toast.service';
import { AuthService } from '../../auth/auth.service';

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
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly auth = inject(AuthService);
  readonly importInput = viewChild<ElementRef<HTMLInputElement>>('importInput');
  readonly categoryOptions = CATEGORY_OPTIONS;
  readonly rsvpOptions = RSVP_OPTIONS;
  readonly cats = CATS;
  readonly rsvpLabels = RSVP_LABELS;
  readonly eventLabels = EVENT_LABELS;
  readonly peopleFor = guestPeople;

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
  isSaving = false;
  rsvpBusyId: string | null = null;
  importPreview: ImportPreviewRow[] | null = null;
  skippedImportRows = 0;
  guestPendingDeletion: Guest | null = null;
  guestPendingInvite: Guest | null = null;
  inviteBusyId: string | null = null;

  readonly filteredGuests = computed(() => {
    const query = this.search().trim().toLowerCase();
    const cat = this.categoryFilter();
    const rsvp = this.rsvpFilter();
    const sortBy = this.sortBy();
    const direction = this.sortDir() === 'asc' ? 1 : -1;
    return this.store.guests().filter(guest => {
      if (cat !== 'all' && guest.category !== cat) return false;
      if (rsvp !== 'all' && !guestPeople(guest).some(person => person.rsvp === rsvp)) return false;
      const searchableName = `${guest.firstName} ${guest.lastName} ${guest.plusOneName} ${guest.kids.map(kid => kid.name).join(' ')} ${guest.dietary} ${guest.notes}`.toLowerCase();
      return !query || searchableName.includes(query);
    }).sort((a, b) => this.sortValue(a, sortBy).localeCompare(this.sortValue(b, sortBy), 'fr') * direction);
  });

  readonly filtersActive = computed(() =>
    Boolean(this.search().trim()) || this.categoryFilter() !== 'all' || this.rsvpFilter() !== 'all',
  );

  openAdd(): void {
    if (!this.auth.can('guests', 'edit')) return;
    this.isAdding = true;
    this.editingGuest = null;
  }

  closeModal(): void {
    if (this.isSaving) return;
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
    if (!this.auth.can('guests', 'edit') || this.isSaving) return;
    this.isSaving = true;
    try {
      if (this.editingGuest) {
        const original = this.editingGuest;
        const patch = Object.fromEntries(Object.entries(guest).filter(([key, value]) =>
          JSON.stringify(value) !== JSON.stringify(original[key as keyof Guest])));
        const savedGuest = await this.guestApi.updateGuest({ ...patch, id: guest.id });
        this.store.updateGuest(savedGuest);
      } else {
        const savedGuest = await this.guestApi.createGuest({ ...guest, id: guest.id || gid() });
        this.store.addGuest(savedGuest);
      }
      this.isAdding = false;
      this.editingGuest = null;
      this.toast.success('Foyer enregistré. Les personnes ayant décliné sont retirées des chambres et des tables.');
    } catch (error) {
      this.toast.error(apiError(error, "Impossible d'enregistrer l'invité."));
    } finally {
      this.isSaving = false;
    }
  }

  requestDeleteGuest(guest: Guest): void {
    if (!this.auth.can('guests', 'edit')) return;
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
      const rows = exportGuestRows(this.store.guests());
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Invités');
      XLSX.writeFile(workbook, 'invites.xlsx');
    } catch {
      this.toast.error("Impossible d'exporter les invités.");
    } finally {
      this.isExporting = false;
      this.changeDetector.markForCheck();
    }
  }

  async updateRsvp(guest: Guest, rsvp: Rsvp): Promise<void> {
    if (!this.auth.can('guests', 'edit') || this.rsvpBusyId) return;
    if (guest.rsvp === rsvp) return;
    this.rsvpBusyId = guest.id;
    try {
      const savedGuest = await this.guestApi.updateGuest({ id: guest.id, rsvp });
      this.store.updateGuest(savedGuest);
      if (rsvp === 'declined') this.toast.success('Réponse enregistrée ; chambre et siège libérés pour cette personne.');
    } catch (error) {
      this.toast.error(apiError(error, "Impossible de modifier le RSVP."));
    } finally {
      this.rsvpBusyId = null;
    }
  }

  async onImportGuests(event: Event): Promise<void> {
    if (!this.auth.can('guests', 'edit') || this.isImporting) return;
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

      this.importPreview = previewGuestImport(importResult.guests, this.store.guests());
      this.skippedImportRows = importResult.skippedRows;
    } catch (error) {
      this.importError = error instanceof Error ? error.message : 'Import impossible. Vérifiez le fichier.';
    } finally {
      this.isImporting = false;
      this.changeDetector.markForCheck();
    }
  }

  importCount(kind: 'new' | 'update'): number {
    return (this.importPreview ?? []).filter(row => kind === 'new' ? row.targetId === 'new' : !['new', 'unresolved', 'skip'].includes(row.targetId)).length;
  }

  importDetails(row: ImportPreviewRow): string[] {
    const g = row.guest;
    return [
      g.email !== undefined ? `E-mail : ${g.email || 'aucun'}` : '',
      g.rsvp ? `RSVP principal : ${this.rsvpLabels[g.rsvp]}` : '',
      g.category ? `Catégorie : ${this.cats[g.category].label}` : '',
      g.organizationRole ? `Rôle : ${g.organizationRole}` : '',
      g.hasPlusOne !== undefined ? `Accompagnateur : ${g.hasPlusOne ? g.plusOneName || 'sans nom' : 'aucun'}` : '',
      g.plusOneRsvp ? `RSVP accompagnateur : ${this.rsvpLabels[g.plusOneRsvp]}` : '',
      g.kids !== undefined ? `Enfants : ${g.kids.map(kid => `${kid.name} (${kid.age === '' ? 'âge non renseigné' : kid.age + ' ans'}${kid.rsvp ? ', ' + this.rsvpLabels[kid.rsvp] : ''})`).join(', ') || 'aucun'}` : '',
      g.needsHousing !== undefined ? `Couchage demandé : ${g.needsHousing ? 'oui' : 'non'}` : '',
      g.dietary !== undefined ? `Alimentation : ${g.dietary || 'non renseignée'}` : '',
      g.events !== undefined ? `Événements : ${g.events.map(key => this.eventLabels[key]).join(', ') || 'aucun'}` : '',
      g.transport !== undefined ? `Transport : ${g.transport || 'non renseigné'}` : '',
      g.notes !== undefined ? `Notes : ${g.notes || 'aucune'}` : '',
    ].filter(Boolean);
  }

  importReady(): boolean {
    const rows = (this.importPreview ?? []).filter(row => row.targetId !== 'skip');
    const targets = rows.filter(row => row.targetId !== 'new').map(row => row.targetId);
    return rows.length > 0 && !targets.includes('unresolved') && new Set(targets).size === targets.length;
  }

  async confirmImport(): Promise<void> {
    if (!this.auth.can('guests', 'edit') || this.isImporting || !this.importReady()) return;
    this.isImporting = true;
    this.importError = '';
    try {
      const rows = this.importPreview!.filter(row => row.targetId !== 'skip');
      const savedGuests = await this.guestApi.mergeGuests(rows.map(row => importPayload(row, this.store.guests())));
      this.store.replaceGuests(savedGuests);
      this.importMessage = `${rows.length} foyers importés. Les autres foyers et les liens d’invitation existants sont conservés.`;
      this.importPreview = null;
    } catch (error) {
      this.importError = apiError(error, error instanceof Error ? error.message : 'Import impossible. Aucune modification enregistrée.');
    } finally {
      this.isImporting = false;
      this.changeDetector.markForCheck();
    }
  }


  async copyInviteLink(guest: Guest): Promise<void> {
    if (!this.auth.can('guests', 'edit')) return;
    this.inviteBusyId = guest.id;
    try {
      const link = await this.guestApi.issueInviteLink(guest.id);
      this.store.updateGuest({ ...guest, hasInviteLink: true });
      await navigator.clipboard.writeText(`${window.location.origin}${link.path}`);
      this.toast.success('Lien d’invitation copié.');
    } catch {
      this.toast.error('Impossible de copier le lien d’invitation.');
    } finally {
      this.inviteBusyId = null;
    }
  }

  requestRegenerateInvite(guest: Guest): void {
    if (!this.auth.can('guests', 'edit')) return;
    this.guestPendingInvite = guest;
  }

  cancelRegenerateInvite(): void {
    this.guestPendingInvite = null;
  }

  async confirmRegenerateInvite(): Promise<void> {
    const guest = this.guestPendingInvite;
    if (!guest) return;
    this.guestPendingInvite = null;
    this.inviteBusyId = guest.id;
    try {
      const link = await this.guestApi.regenerateInviteLink(guest.id);
      this.store.updateGuest({ ...guest, hasInviteLink: true });
      await navigator.clipboard.writeText(`${window.location.origin}${link.path}`);
      this.toast.success('Nouveau lien copié. L’ancien ne fonctionne plus.');
    } catch {
      this.toast.error('Impossible de régénérer le lien.');
    } finally {
      this.inviteBusyId = null;
    }
  }

  private sortValue(guest: Guest, key: GuestSortKey): string {
    if (key === 'category') return this.cats[guest.category].label;
    if (key === 'rsvp') return this.rsvpLabels[guest.rsvp];
    return `${guest.lastName} ${guest.firstName}`.trim();
  }
}
