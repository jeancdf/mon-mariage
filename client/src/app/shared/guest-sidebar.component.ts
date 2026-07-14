import { Component, computed, input, output, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { GuestCategory } from '../data/types';
import { CATS } from '../data/seed';
import { GuestPerson } from './wedding-utils';

interface CategoryOption {
  value: 'all' | GuestCategory;
  label: string;
}

@Component({
  selector: 'app-guest-sidebar',
  standalone: true,
  imports: [FormsModule, CdkDrag, CdkDropList],
  template: `
    <aside class="guest-sidebar">
      <div class="guest-sidebar-head">
        <div class="eyebrow">{{ label() }} · {{ guests().length }}</div>
        <input
          class="guest-sidebar-search"
          type="search"
          placeholder="Rechercher…"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)" />
        <div class="guest-sidebar-filters">
          @for (option of categoryOptions; track option.value) {
            <button
              type="button"
              class="filter-pill"
              [class.active]="categoryFilter() === option.value"
              (click)="categoryFilter.set(option.value)">
              {{ option.label }}
            </button>
          }
        </div>
      </div>

      <div
        class="guest-sidebar-list"
        cdkDropList
        cdkDropListSortingDisabled
        [cdkDropListDisabled]="dragDisabled()"
        [cdkDropListData]="'sidebar'"
        (cdkDropListDropped)="onDrop($event)">
        <div class="guest-sidebar-dropzone">Déposer ici pour retirer</div>
        @if (filtered().length === 0) {
          <div class="guest-sidebar-empty">{{ loading() ? 'Chargement…' : 'Aucun résultat' }}</div>
        }
        @for (guest of filtered(); track guest.id) {
          <div
            class="guest-row"
            cdkDrag
            [cdkDragDisabled]="dragDisabled()"
            [cdkDragData]="guest.id"
            (cdkDragStarted)="dragStarted.emit()"
            (cdkDragEnded)="dragEnded.emit()"
            [attr.data-cat]="guest.category">
            <span class="guest-avatar" [attr.data-cat]="guest.category">{{ initials(guest) }}</span>
            <span class="guest-row-text">
              <span class="guest-row-name">{{ guest.firstName }} {{ guest.lastName }}</span>
              <span class="guest-row-cat" [attr.data-cat]="guest.category">{{ guest.isKid ? 'Enfant · ' : guest.isPlusOne ? '+1 · ' : '' }}{{ catShort(guest.category) }}</span>
            </span>
            <span class="guest-row-grip" aria-hidden="true">⠿</span>
          </div>
        }
      </div>
    </aside>
  `,
})
export class GuestSidebarComponent {
  readonly guests = input.required<GuestPerson[]>();
  readonly label = input('');
  readonly loading = input(false);
  readonly dragDisabled = input(false);
  readonly guestDropped = output<string>();
  readonly dragStarted = output<void>();
  readonly dragEnded = output<void>();

  readonly search = signal('');
  readonly categoryFilter = signal<'all' | GuestCategory>('all');

  readonly categoryOptions: CategoryOption[] = [
    { value: 'all', label: 'Tous' },
    ...(Object.keys(CATS) as GuestCategory[]).map(value => ({ value, label: CATS[value].short })),
  ];

  readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    const cat = this.categoryFilter();
    return this.guests().filter(guest => {
      if (cat !== 'all' && guest.category !== cat) return false;
      if (!query) return true;
      return `${guest.firstName} ${guest.lastName}`.toLowerCase().includes(query);
    });
  });

  initials(guest: GuestPerson): string {
    return `${guest.firstName[0] ?? ''}${guest.lastName[0] ?? ''}`;
  }

  catShort(category: GuestCategory): string {
    return CATS[category]?.short ?? '';
  }

  onDrop(event: CdkDragDrop<string>): void {
    if (this.dragDisabled()) return;
    if (event.previousContainer === event.container) return;
    this.guestDropped.emit(event.item.data as string);
  }
}
