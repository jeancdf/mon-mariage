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
  readonly organizerBusy = signal(false);
  resetPending: AdminAccount | null = null;
  passwordPending: AdminAccount | null = null;
  currentPassword = '';
  newPassword = '';
  pendingPassword = '';
  organizerName = '';
  organizerEmail = '';
  organizerPassword = '';
  organizerPasswordConfirm = '';

  readonly sections = [
    { key: 'dashboard', label: 'Tableau de bord' },
    { key: 'guests', label: 'Invités' },
    { key: 'vendors', label: 'Prestataires' },
    { key: 'housing', label: 'Hébergement' },
    { key: 'seating', label: 'Plan de table' },
    { key: 'budget', label: 'Budget' },
    { key: 'todos', label: 'À faire' },
    { key: 'final_weeks', label: 'Dernières semaines' },
  ] as const;

  constructor() { void this.reload(); }

  currentAccountId(): string | undefined {
    return this.auth.account()?.id;
  }

  canCreateOrganizer(): boolean {
    return Boolean(
      this.organizerName.trim()
      && this.organizerEmail.trim()
      && this.organizerPassword.length >= 12
      && this.organizerPassword === this.organizerPasswordConfirm,
    );
  }

  profileLabel(account: AdminAccount): string {
    return account.isOrganizer ? 'Organisateur' : account.profileKey;
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const [accounts, profiles] = await Promise.all([
        this.api.listAccounts(),
        this.api.listProfiles(),
      ]);
      this.accounts.set(accounts);
      this.profiles.set(profiles);
    } catch {
      this.toast.error("Impossible de charger l'administration.");
    } finally {
      this.loading.set(false);
    }
  }

  permission(profile: AdminProfile, section: typeof this.sections[number]['key']) {
    return profile.permissions.find(permission => permission.section === section)!;
  }

  async saveProfile(profile: AdminProfile): Promise<void> {
    try {
      const saved = await this.api.saveProfile(profile);
      this.profiles.update(profiles => profiles.map(item =>
        item.key === saved.key ? saved : item));
      this.toast.success(`Profil « ${saved.name} » enregistré.`);
    } catch {
      this.toast.error("Impossible d'enregistrer ce profil.");
    }
  }

  async createOrganizer(): Promise<void> {
    if (!this.canCreateOrganizer() || this.organizerBusy()) return;
    if (this.organizerPassword !== this.organizerPasswordConfirm) {
      this.toast.error('Les deux mots de passe ne correspondent pas.');
      return;
    }
    this.organizerBusy.set(true);
    try {
      await this.api.createOrganizer({
        displayName: this.organizerName.trim(),
        email: this.organizerEmail.trim(),
        password: this.organizerPassword,
      });
      this.organizerName = '';
      this.organizerEmail = '';
      this.organizerPassword = '';
      this.organizerPasswordConfirm = '';
      await this.reload();
      this.toast.success('Compte organisateur créé. Elle peut se connecter.');
    } catch (error: unknown) {
      this.toast.error(this.messageOf(
        error,
        'Impossible de créer ce compte.',
      ));
    } finally {
      this.organizerBusy.set(false);
    }
  }

  async enableGuest(guestId: string): Promise<void> {
    try {
      await this.api.enableGuest(guestId);
      await this.reload();
      this.toast.success('Compte préparé.');
    } catch (error: unknown) {
      this.toast.error(this.messageOf(error, 'Impossible de préparer ce compte.'));
    }
  }

  async setStatus(account: AdminAccount, status: AdminAccount['status']): Promise<void> {
    if (account.status === status) return;
    try {
      await this.api.setStatus(account.id, status);
      await this.reload();
    } catch (error: unknown) {
      this.toast.error(this.messageOf(error, 'Impossible de modifier ce compte.'));
    }
  }

  async confirmReset(): Promise<void> {
    const account = this.resetPending;
    this.resetPending = null;
    if (!account) return;
    try {
      await this.api.reset(account.id);
      await this.reload();
      this.toast.success('Compte remis en attente d’activation.');
    } catch {
      this.toast.error('Impossible de réinitialiser ce compte.');
    }
  }

  cancelPassword(): void {
    this.passwordPending = null;
    this.pendingPassword = '';
  }

  async confirmPassword(): Promise<void> {
    const account = this.passwordPending;
    const password = this.pendingPassword;
    if (!account || password.length < 12) return;
    this.cancelPassword();
    try {
      await this.api.reset(account.id, password);
      await this.reload();
      this.toast.success('Mot de passe enregistré.');
    } catch (error: unknown) {
      this.toast.error(this.messageOf(
        error,
        'Impossible d’enregistrer ce mot de passe.',
      ));
    }
  }

  hasAccount(guestId: string): boolean {
    return this.accounts().some(account => account.guestId === guestId);
  }

  async changePassword(): Promise<void> {
    try {
      await this.auth.changePassword(this.currentPassword, this.newPassword);
      await this.router.navigateByUrl('/connexion');
    } catch (error: unknown) {
      this.toast.error(this.messageOf(
        error,
        'Impossible de changer le mot de passe.',
      ));
    }
  }

  private messageOf(error: unknown, fallback: string): string {
    const response = error as { error?: { message?: string } };
    return response.error?.message ?? fallback;
  }
}
