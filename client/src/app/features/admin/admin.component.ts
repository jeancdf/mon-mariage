import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { AdminAccount, AdminApiService, AdminProfile, MailStatus } from '../../data/admin-api.service';
import { WeddingStore } from '../../data/store';
import { Guest } from '../../data/types';
import { ToastService } from '../../shared/toast.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, DatePipe],
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
  readonly mailTestPending = signal(false);
  readonly mailStatus = signal<MailStatus | null>(null);
  readonly mailTestError = signal<string | null>(null);
  readonly organizerEmail = computed(() => this.auth.account()?.email ?? '');
  invitationPendingId: string | null = null;
  currentPassword = '';
  newPassword = '';

  readonly sections = [
    { key: 'dashboard', label: 'Tableau de bord' }, { key: 'guests', label: 'Invités' },
    { key: 'vendors', label: 'Prestataires' }, { key: 'housing', label: 'Hébergement' },
    { key: 'seating', label: 'Plan de table' }, { key: 'budget', label: 'Budget' },
    { key: 'todos', label: 'À faire' }, { key: 'final_weeks', label: 'Dernières semaines' },
  ] as const;

  constructor() {
    void this.reload();
    void this.loadMailStatus();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const [accounts, profiles] = await Promise.all([this.api.listAccounts(), this.api.listProfiles()]);
      this.accounts.set(accounts);
      this.profiles.set(profiles);
    } catch { this.toast.error("Impossible de charger l'administration."); }
    finally { this.loading.set(false); }
  }

  async loadMailStatus(): Promise<void> {
    try { this.mailStatus.set(await this.api.mailStatus()); }
    catch { this.mailStatus.set(null); }
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

  async inviteGuest(guest: Guest): Promise<void> {
    this.invitationPendingId = guest.id;
    try {
      await this.api.enableGuest(guest.id);
      await this.reload();
      this.toast.success(`Compte créé et invitation envoyée à ${guest.email}.`);
    } catch (error: unknown) {
      const response = error as { error?: { message?: string } };
      this.toast.error(response.error?.message ?? "Impossible d'envoyer l'invitation.");
    } finally {
      this.invitationPendingId = null;
    }
  }

  async inviteAccount(account: AdminAccount): Promise<void> {
    this.invitationPendingId = account.id;
    try {
      await this.api.invite(account.id);
      await this.reload();
      this.toast.success(`Invitation envoyée à ${account.email}.`);
    } catch (error: unknown) {
      const response = error as { error?: { message?: string } };
      this.toast.error(response.error?.message ?? "Impossible d'envoyer l'invitation.");
    } finally {
      this.invitationPendingId = null;
    }
  }

  async setStatus(account: AdminAccount, status: 'active' | 'disabled'): Promise<void> {
    if (account.status === status) return;
    try { await this.api.setStatus(account.id, status); await this.reload(); }
    catch (error: unknown) { const response = error as { error?: { message?: string } }; this.toast.error(response.error?.message ?? 'Impossible de modifier ce compte.'); }
  }

  hasAccount(guestId: string): boolean { return this.accounts().some(account => account.guestId === guestId); }

  async sendTestEmail(): Promise<void> {
    this.mailTestPending.set(true);
    this.mailTestError.set(null);
    try {
      const result = await this.api.sendTestEmail();
      this.toast.success(`E-mail de test envoyé à ${result.email}. Vérifiez aussi les spams.`);
    } catch (error: unknown) {
      const response = error as { error?: { message?: string } };
      const message = response.error?.message ?? "Impossible d'envoyer l'e-mail de test.";
      this.mailTestError.set(message);
      this.toast.error(message);
    } finally {
      this.mailTestPending.set(false);
    }
  }

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
