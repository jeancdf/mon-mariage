import { TestBed } from '@angular/core/testing';
import { GuestsComponent } from './guests.component';
import { GuestApiService } from '../../data/guest-api.service';
import { AuthService } from '../../auth/auth.service';
import * as XLSX from 'xlsx';

describe('Guest import rendering', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: GuestApiService, useValue: {} },
      { provide: AuthService, useValue: { can: () => true } },
    ] });
  });

  it('renders the preview after asynchronous file parsing without another user action', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Prénom', 'Nom'], ['Camille', 'Martin']]), 'Invités');
    const file = { arrayBuffer: async () => XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) };
    const fixture = TestBed.createComponent(GuestsComponent);
    fixture.detectChanges();
    await fixture.componentInstance.onImportGuests({ target: { files: [file], value: 'invites.xlsx' } } as unknown as Event);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Vérifier l’import');
    expect(fixture.nativeElement.textContent).toContain('1 foyers à ajouter');
    expect(fixture.componentInstance.isImporting).toBe(false);
  });

  it('renders parsing errors and restores the import button', async () => {
    const file = { arrayBuffer: async () => { throw new Error('Feuille invalide'); } };
    const fixture = TestBed.createComponent(GuestsComponent);
    fixture.detectChanges();
    await fixture.componentInstance.onImportGuests({ target: { files: [file], value: 'invites.xlsx' } } as unknown as Event);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('Feuille invalide');
    expect(fixture.componentInstance.isImporting).toBe(false);
  });
});
