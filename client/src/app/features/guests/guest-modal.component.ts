import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EventKey, Guest, Kid } from '../../data/types';
import { gid } from '../../data/seed';
import { CATEGORY_OPTIONS, cloneGuest, emptyGuest, EVENT_OPTIONS, RSVP_OPTIONS } from '../../shared/wedding-utils';
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

  readonly categoryOptions = CATEGORY_OPTIONS;
  readonly rsvpOptions = RSVP_OPTIONS;
  readonly eventOptions = EVENT_OPTIONS;
  form: Guest = emptyGuest();
  isEditing = false;

  @Input() set guest(value: Guest | null) {
    this.isEditing = Boolean(value);
    this.form = value ? cloneGuest(value) : emptyGuest();
  }

  toggleEvent(eventKey: EventKey): void {
    this.form.events = this.form.events.includes(eventKey)
      ? this.form.events.filter(key => key !== eventKey)
      : [...this.form.events, eventKey];
  }

  addKid(): void {
    this.form.kids = [...this.form.kids, { id: gid(), name: '', age: '' }];
  }

  removeKid(index: number): void {
    this.form.kids = this.form.kids.filter((_, kidIndex) => kidIndex !== index);
  }

  trackKid(_index: number, kid: Kid): string {
    return kid.id;
  }

  submit(): void {
    if (!this.form.firstName.trim() || !this.form.lastName.trim()) return;
    this.saveGuest.emit(cloneGuest(this.form));
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeModal.emit();
  }
}
