import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { AdminAccount, AdminApiService, AdminProfile } from '../../data/admin-api.service';
import { WeddingStore } from '../../data/store';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ToastService } from '../../shared/toast.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, ConfirmDialogComponent, DatePipe],
  templateUrl: './admin.component.html',
})
export class AdminComponent {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly store = inject(WeddingStore);
  readonly accounts = signal<AdminAccount[]>([]);
  readonly profiles = signal<AdminProfile[]>([]);
  readonly loading = signal(true);
  resetPending: AdminAccount | null = null;
  currentPassword = '';
  newPassword = '';

  readonly sections = [
    { key: 'dashboard', label: 'Tableau de bord' }, { key: 'guests', label: 'Invités' },
    { key: 'vendors', label: 'Prestataires' }, { key: 'housing', label: 'Hébergement' },
    { key: 'seating', label: 'Plan de table' }, { key: 'budget', label: 'Budget' },
    { key: 'todos', label: 'À faire' }, { key: 'final_weeks', label: 'Dernières semaines' },
  ] as const;

  constructor() { void this.reload(); }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const [accounts, profiles] = await Promise.all([this.api.listAccounts(), this.api.listProfiles()]);
      this.accounts.set(accounts);
      this.profiles.set(profiles);
    } catch { this.toast.error("Impossible de charger l'administration."); }
    finally { this.loading.set(false); }
  }

  permission(profile: AdminProfile, section: typeof this.sections[number]['key']) {
    return profile.permissions.find(permission => permission.section === section)!;
  }

  async saveProfile(profile: AdminProfile): Promise<void> {
    try {
      const saved = await this.api.saveProfile(profile);
      this.profiles.update(profiles => profiles.map(item => item.key === saved.key ? saved : item));
      this.toast.success(`Profil « ${saved.name} » enregistré.`);
    } catch { this.toast.error("Impossible d'enregistrer ce profil."); }
  }

  async enableGuest(guestId: string): Promise<void> {
    try { await this.api.enableGuest(guestId); await this.reload(); this.toast.success('Compte préparé.'); }
    catch (error: unknown) { const response = error as { error?: { message?: string } }; this.toast.error(response.error?.message ?? 'Impossible de préparer ce compte.'); }
  }

  async setStatus(account: AdminAccount, status: AdminAccount['status']): Promise<void> {
    if (account.status === status) return;
    try { await this.api.setStatus(account.id, status); await this.reload(); }
    catch (error: unknown) { const response = error as { error?: { message?: string } }; this.toast.error(response.error?.message ?? 'Impossible de modifier ce compte.'); }
  }

  async confirmReset(): Promise<void> {
    const account = this.resetPending;
    this.resetPending = null;
    if (!account) return;
    try { await this.api.reset(account.id); await this.reload(); this.toast.success('Compte remis en attente d’activation.'); }
    catch { this.toast.error('Impossible de réinitialiser ce compte.'); }
  }

  hasAccount(guestId: string): boolean { return this.accounts().some(account => account.guestId === guestId); }

  async changePassword(): Promise<void> {
    try {
      await this.auth.changePassword(this.currentPassword, this.newPassword);
      await this.router.navigateByUrl('/connexion');
    } catch (error: unknown) {
      const response = error as { error?: { message?: string } };
      this.toast.error(response.error?.message ?? 'Impossible de changer le mot de passe.');
    }
  }
}
