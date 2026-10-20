import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EventKey, Guest, Kid, Rsvp } from '../../data/types';
import { gid } from '../../data/seed';
import { CATEGORY_OPTIONS, cloneGuest, emptyGuest, EVENT_OPTIONS, ORGANIZATION_ROLE_OPTIONS, RSVP_OPTIONS } from '../../shared/wedding-utils';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-guest-modal',
  standalone: true,
  imports: [FormsModule, IconComponent],
  templateUrl: './guest-modal.component.html',
})
export class GuestModalComponent {
  @Output() closeModal = new EventEmitter<void>();
  @Output() saveGuest = new EventEmitter<Guest>();
  @Input() saving = false;

  readonly categoryOptions = CATEGORY_OPTIONS;
  readonly rsvpOptions = RSVP_OPTIONS;
  readonly eventOptions = EVENT_OPTIONS;
  readonly organizationRoleOptions = ORGANIZATION_ROLE_OPTIONS;
  form: Guest = emptyGuest();
  isEditing = false;

  @Input() set guest(value: Guest | null) {
    this.isEditing = Boolean(value);
    this.form = value ? cloneGuest(value) : emptyGuest();
    this.form.plusOneRsvp ??= this.form.rsvp;
    this.form.kids = this.form.kids.map(kid => ({ ...kid, rsvp: kid.rsvp ?? this.form.rsvp }));
  }

  toggleEvent(eventKey: EventKey): void {
    this.form.events = this.form.events.includes(eventKey)
      ? this.form.events.filter(key => key !== eventKey)
      : [...this.form.events, eventKey];
  }

  addKid(): void {
    this.form.kids = [...this.form.kids, { id: gid(), name: '', age: '', rsvp: 'pending' }];
  }

  applyHouseholdRsvp(rsvp: Rsvp): void {
    this.form = { ...this.form, rsvp, plusOneRsvp: rsvp, kids: this.form.kids.map(kid => ({ ...kid, rsvp })) };
  }

  valid(): boolean {
    return Boolean(this.form.firstName.trim()) && this.form.kids.every(kid => kid.name.trim()
      && (kid.age === '' || (Number.isInteger(Number(kid.age)) && Number(kid.age) >= 0 && Number(kid.age) <= 17)));
  }

  removeKid(index: number): void {
    this.form.kids = this.form.kids.filter((_, kidIndex) => kidIndex !== index);
  }

  trackKid(_index: number, kid: Kid): string {
    return kid.id;
  }

  submit(): void {
    if (this.saving || !this.valid()) return;
    this.saveGuest.emit(cloneGuest(this.form));
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.saving) this.closeModal.emit();
  }
}
