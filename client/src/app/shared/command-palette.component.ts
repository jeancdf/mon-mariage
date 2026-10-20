import { Component, DOCUMENT, EventEmitter, HostListener, Output, computed, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { WeddingStore } from '../data/store';
import { AutofocusDirective } from './autofocus.directive';
import { IconComponent } from './icon.component';
import { IconName, NAV_ITEMS } from './wedding-utils';

interface PaletteOption {
  readonly label: string;
  readonly icon: IconName;
  /** Pages navigate to their path; guests open the guests page filtered on their name. */
  readonly path?: string;
}

const MAX_GUEST_RESULTS = 8;

/** Lowercases and strips accents so "hebergement" matches "Hébergement". */
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [AutofocusDirective, IconComponent],
  template: `
    <div class="modal-backdrop palette-backdrop" (click)="dismissed.emit()">
      <section class="modal command-palette" role="dialog" aria-modal="true" aria-label="Recherche rapide" (click)="$event.stopPropagation()">
        <div class="palette-search">
          <app-icon name="search" />
          <input
            type="text"
            appAutofocus
            role="combobox"
            aria-autocomplete="list"
            aria-controls="command-palette-list"
            autocomplete="off"
            placeholder="Rechercher une page ou un invité…"
            [attr.aria-expanded]="options().length > 0"
            [attr.aria-activedescendant]="options().length ? optionId(activeIndex()) : null"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            (keydown)="onKeydown($event)" />
        </div>

        <div class="palette-results" id="command-palette-list" role="listbox" aria-label="Résultats">
          @if (pages().length) {
            <div role="group" aria-labelledby="command-palette-pages">
              <div class="palette-group-label" id="command-palette-pages" role="presentation">Pages</div>
              @for (page of pages(); track page.path; let index = $index) {
                <div
                  class="palette-option"
                  role="option"
                  [id]="optionId(index)"
                  [attr.aria-selected]="activeIndex() === index"
                  (mousedown)="$event.preventDefault()"
                  (click)="activate(page)">
                  <app-icon [name]="page.icon" />
                  <span>{{ page.label }}</span>
                </div>
              }
            </div>
          }
          @if (guests().length) {
            <div role="group" aria-labelledby="command-palette-guests">
              <div class="palette-group-label" id="command-palette-guests" role="presentation">Invités</div>
              @for (guest of guests(); track $index; let index = $index) {
                <div
                  class="palette-option"
                  role="option"
                  [id]="optionId(pages().length + index)"
                  [attr.aria-selected]="activeIndex() === pages().length + index"
                  (mousedown)="$event.preventDefault()"
                  (click)="activate(guest)">
                  <app-icon [name]="guest.icon" />
                  <span>{{ guest.label }}</span>
                </div>
              }
            </div>
          }
        </div>

        @if (!options().length) {
          <p class="palette-empty" role="status">Aucun résultat</p>
        }
      </section>
    </div>
  `,
})
export class CommandPaletteComponent {
  private readonly auth = inject(AuthService);
  private readonly store = inject(WeddingStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  @Output() dismissed = new EventEmitter<void>();
  @Output() navigated = new EventEmitter<void>();

  readonly query = signal('');

  /** Same entries as the sidebar: permitted NAV_ITEMS plus Administration for organizers. */
  readonly pages = computed<PaletteOption[]>(() => {
    const query = normalize(this.query().trim());
    const pages: PaletteOption[] = NAV_ITEMS.filter(item => this.auth.can(item.section));
    if (this.auth.isOrganizer()) pages.push({ label: 'Administration', icon: 'shield', path: '/administration' });
    return pages.filter(page => normalize(page.label).includes(query));
  });

  readonly guests = computed<PaletteOption[]>(() => {
    const query = normalize(this.query().trim());
    if (!query || !this.auth.can('guests')) return [];
    return this.store.guests()
      .map(guest => `${guest.firstName} ${guest.lastName}`)
      .filter(name => normalize(name).includes(query))
      .sort((a, b) => a.localeCompare(b, 'fr'))
      .slice(0, MAX_GUEST_RESULTS)
      .map((name): PaletteOption => ({ label: name, icon: 'guests' }));
  });

  readonly options = computed(() => [...this.pages(), ...this.guests()]);
  /** Resets to the first option whenever the result list changes. */
  readonly activeIndex = linkedSignal({ source: this.options, computation: () => 0 });

  optionId(index: number): string {
    return `command-palette-option-${index}`;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dismissed.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    const count = this.options().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (!count) return;
        this.activeIndex.set((this.activeIndex() + (event.key === 'ArrowDown' ? 1 : -1) + count) % count);
        this.document.getElementById(this.optionId(this.activeIndex()))?.scrollIntoView({ block: 'nearest' });
        break;
      case 'Enter': {
        event.preventDefault();
        const option = this.options()[this.activeIndex()];
        if (option) void this.activate(option);
        break;
      }
      case 'Tab':
        // The input is the only focusable element: keep focus inside the dialog.
        event.preventDefault();
        break;
    }
  }

  async activate(option: PaletteOption): Promise<void> {
    this.navigated.emit();
    if (option.path) {
      await this.router.navigateByUrl(option.path);
    } else {
      await this.router.navigate(['/invites'], { queryParams: { recherche: option.label } });
    }
  }
}
