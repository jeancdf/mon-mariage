import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventKey, Rsvp } from '../../data/types';
import { PublicApiService, PublicRsvpHousehold, PublicRsvpPerson } from '../../data/public-api.service';
import { EVENT_OPTIONS } from '../../shared/wedding-utils';
import { PublicThemeService } from './public-theme.service';
import { PublicThemeToggleComponent } from './public-theme-toggle.component';

@Component({
  selector: 'app-rsvp',
  standalone: true,
  imports: [FormsModule, RouterLink, PublicThemeToggleComponent],
  templateUrl: './rsvp.component.html',
})
export class RsvpComponent {
  private readonly api = inject(PublicApiService);
  private readonly route = inject(ActivatedRoute);
  readonly publicTheme = inject(PublicThemeService);
  readonly eventOptions = EVENT_OPTIONS;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly error = signal('');
  household: PublicRsvpHousehold | null = null;
  people: PublicRsvpPerson[] = [];
  events: EventKey[] = [];
  dietary = '';
  transport = '';
  needsHousing = false;

  constructor() {
    void this.load();
  }

  private token(): string {
    return this.route.snapshot.paramMap.get('token') ?? '';
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const household = await this.api.loadHousehold(this.token());
      this.applyHousehold(household);
      this.error.set('');
    } catch {
      this.household = null;
      this.error.set('Cette invitation est introuvable ou n’est plus valable.');
    } finally {
      this.loading.set(false);
    }
  }

  setPersonRsvp(person: PublicRsvpPerson, rsvp: Rsvp): void {
    this.people = this.people.map(item => item.id === person.id ? { ...item, rsvp } : item);
  }

  toggleEvent(eventKey: EventKey): void {
    this.events = this.events.includes(eventKey)
      ? this.events.filter(key => key !== eventKey)
      : [...this.events, eventKey];
  }

  async submit(): Promise<void> {
    if (!this.household || this.people.some(person => person.rsvp === 'pending')) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const saved = await this.api.submitHousehold(this.token(), {
        people: this.people.map(person => ({ id: person.id, rsvp: person.rsvp })),
        events: this.events,
        dietary: this.dietary,
        transport: this.transport,
        needsHousing: this.needsHousing,
      });
      this.applyHousehold(saved);
      this.submitted.set(true);
    } catch {
      this.error.set('Impossible d’enregistrer votre réponse. Réessayez.');
    } finally {
      this.saving.set(false);
    }
  }

  kindLabel(kind: PublicRsvpPerson['kind']): string {
    if (kind === 'plusOne') return 'Accompagnateur';
    if (kind === 'kid') return 'Enfant';
    return 'Invité';
  }

  private applyHousehold(household: PublicRsvpHousehold): void {
    this.household = household;
    this.people = household.people.map(person => ({ ...person }));
    this.events = [...household.events];
    this.dietary = household.dietary;
    this.transport = household.transport;
    this.needsHousing = household.needsHousing;
  }
}
