import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <div class="modal-backdrop" (click)="cancel.emit()">
      <section class="modal confirm-modal" role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId" (click)="$event.stopPropagation()">
        <header class="modal-header">
          <h2 [id]="titleId">{{ title }}</h2>
        </header>

        <p>{{ message }}</p>

        @if (details) {
          <p class="confirm-detail">{{ details }}</p>
        }

        <footer class="modal-actions">
          <button class="btn secondary" type="button" (click)="cancel.emit()">{{ cancelLabel }}</button>
          <button class="btn danger-solid" type="button" (click)="confirm.emit()">{{ confirmLabel }}</button>
        </footer>
      </section>
    </div>
  `,
})
export class ConfirmDialogComponent {
  @Input() title = 'Confirmer la suppression';
  @Input() message = 'Cette action est définitive.';
  @Input() details = '';
  @Input() cancelLabel = 'Annuler';
  @Input() confirmLabel = 'Supprimer';
  @Input() titleId = 'confirm-dialog-title';
  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
}
