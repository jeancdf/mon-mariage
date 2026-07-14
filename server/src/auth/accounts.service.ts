import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { GuestEntity, OrganizationRole } from '../guests/guest.entity';
import { PasswordService } from './password.service';
import { AccessProfileEntity } from './entities/access-profile.entity';
import { AccountEntity } from './entities/account.entity';
import { PermissionEntity } from './entities/permission.entity';
import { SessionEntity } from './entities/session.entity';
import { AccessProfileKey, CookieResponse, SECTION_KEYS, SectionKey } from './auth.types';

const COOKIE_NAME = 'mm_session';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const PROFILE_NAMES: Record<AccessProfileKey, string> = {
  organizer: 'Organisateurs',
  parent: 'Parents',
  sibling: 'Fratrie',
  witness: 'Témoins',
  friend_cousin: 'Amis / Cousins',
  other: 'Autres',
};

const DEFAULT_PERMISSIONS: Record<AccessProfileKey, Partial<Record<SectionKey, [boolean, boolean]>>> = {
  organizer: Object.fromEntries(SECTION_KEYS.map(section => [section, [true, true]])) as Record<SectionKey, [boolean, boolean]>,
  parent: {
    dashboard: [true, false], guests: [true, false], housing: [true, false], seating: [true, false],
    todos: [true, false], final_weeks: [true, true],
  },
  sibling: {
    dashboard: [true, false], guests: [true, false], housing: [true, false], seating: [true, false],
    todos: [true, false], final_weeks: [true, true],
  },
  witness: {
    dashboard: [true, false], guests: [true, false], housing: [true, false], seating: [true, false],
    todos: [true, false], final_weeks: [true, true],
  },
  friend_cousin: { final_weeks: [true, true] },
  other: {},
};

export const normalizeEmail = (email: unknown): string => String(email ?? '').trim().toLocaleLowerCase('fr-FR');

export const profileForOrganizationRole = (role: OrganizationRole): AccessProfileKey => {
  if (role === 'parent') return 'parent';
  if (role === 'sibling') return 'sibling';
  if (role === 'witness') return 'witness';
  if (role === 'friend_cousin') return 'friend_cousin';
  return 'other';
};

@Injectable()
export class AccountsService implements OnModuleInit {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectRepository(AccountEntity) private readonly accountsRepository: Repository<AccountEntity>,
    @InjectRepository(SessionEntity) private readonly sessionsRepository: Repository<SessionEntity>,
    @InjectRepository(AccessProfileEntity) private readonly profilesRepository: Repository<AccessProfileEntity>,
    @InjectRepository(PermissionEntity) private readonly permissionsRepository: Repository<PermissionEntity>,
    @InjectRepository(GuestEntity) private readonly guestsRepository: Repository<GuestEntity>,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.validateProductionConfiguration();
    await this.seedProfiles();
    await this.ensureBootstrapOrganizer();
  }

  async claim(emailValue: unknown, eventCode: unknown, password: string): Promise<AccountEntity> {
    const email = normalizeEmail(emailValue);
    this.assertUsableEmail(email);
    if (!this.safeEqual(String(eventCode ?? ''), this.config.get<string>('PRIVATE_EVENT_CODE', 'dev-event-code'))) {
      throw new ForbiddenException('Code privé incorrect.');
    }
    const account = await this.accountWithPassword(email);
    if (!account || account.status !== 'pending' || account.passwordHash) {
      throw new BadRequestException("Ce compte ne peut pas être activé.");
    }
    account.passwordHash = await this.passwords.hash(password);
    account.status = 'active';
    return this.accountsRepository.save(account);
  }

  async login(emailValue: unknown, password: string, ip: string): Promise<AccountEntity> {
    const email = normalizeEmail(emailValue);
    const account = await this.accountWithPassword(email);
    const valid = await this.passwords.verify(password, account?.passwordHash ?? null);
    if (!account || !valid || account.status !== 'active') {
      throw new UnauthorizedException('Adresse e-mail ou mot de passe incorrect.');
    }
    account.lastLoginAt = new Date();
    account.lastLoginIp = String(ip ?? '').slice(0, 200);
    return this.accountsRepository.save(account);
  }

  async createSession(account: AccountEntity, response: CookieResponse, userAgent: string): Promise<{ csrfToken: string }> {
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.sessionsRepository.save(this.sessionsRepository.create({
      accountId: account.id,
      tokenHash: this.hashSessionToken(token),
      csrfTokenHash: this.hashCsrfToken(csrfToken),
      expiresAt,
      revokedAt: null,
      lastSeenAt: new Date(),
      userAgent: String(userAgent ?? '').slice(0, 500),
    }));
    response.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_DURATION_MS,
    });
    return { csrfToken };
  }

  async resolveSession(cookieHeader: string): Promise<SessionEntity | null> {
    const token = this.readCookie(cookieHeader, COOKIE_NAME);
    if (!token) return null;
    const session = await this.sessionsRepository.findOne({
      where: { tokenHash: this.hashSessionToken(token), revokedAt: IsNull() },
      relations: { account: { profile: { permissions: true } } },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now() || session.account.status !== 'active') {
      if (!session.revokedAt) {
        session.revokedAt = new Date();
        await this.sessionsRepository.save(session);
      }
      return null;
    }
    if (!session.lastSeenAt || Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      session.lastSeenAt = new Date();
      await this.sessionsRepository.save(session);
    }
    return session;
  }

  async rotateCsrfToken(session: SessionEntity): Promise<string> {
    const csrfToken = randomBytes(24).toString('base64url');
    session.csrfTokenHash = this.hashCsrfToken(csrfToken);
    await this.sessionsRepository.save(session);
    return csrfToken;
  }

  verifyCsrfToken(session: SessionEntity, token: string): boolean {
    return this.safeEqual(session.csrfTokenHash, this.hashCsrfToken(token));
  }

  async logout(session: SessionEntity, response: CookieResponse): Promise<void> {
    session.revokedAt = new Date();
    await this.sessionsRepository.save(session);
    this.clearCookie(response);
  }

  clearCookie(response: CookieResponse): void {
    response.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  async changePassword(accountId: string, currentPassword: string, newPassword: string): Promise<void> {
    const account = await this.accountsRepository.createQueryBuilder('account')
      .addSelect('account.passwordHash')
      .where('account.id = :accountId', { accountId })
      .getOne();
    if (!account || !(await this.passwords.verify(currentPassword, account.passwordHash))) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }
    account.passwordHash = await this.passwords.hash(newPassword);
    await this.accountsRepository.save(account);
    await this.sessionsRepository.update({ accountId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async assertGuestAccountEmail(emailValue: unknown, guestId: string | undefined, role: OrganizationRole): Promise<void> {
    const email = normalizeEmail(emailValue);
    if (!email || !['parent', 'sibling', 'witness'].includes(role)) return;
    this.assertUsableEmail(email);
    const existing = await this.accountsRepository.findOne({ where: { email } });
    if (existing && existing.guestId !== (guestId ?? null)) {
      throw new ConflictException('Cette adresse e-mail est déjà rattachée à un compte.');
    }
  }

  async syncGuestAccount(guest: GuestEntity): Promise<void> {
    const email = normalizeEmail(guest.email);
    const profileKey = profileForOrganizationRole(guest.organizationRole);
    let account = await this.accountsRepository.findOne({ where: { guestId: guest.id } });
    const eligibleForAutomaticAccount = ['parent', 'sibling', 'witness'].includes(guest.organizationRole);
    if (!account && (!eligibleForAutomaticAccount || !email)) return;
    if (!account && email) {
      const matchingEmail = await this.accountsRepository.findOne({ where: { email } });
      if (matchingEmail && !matchingEmail.isOrganizer) {
        account = matchingEmail;
        account.guestId = guest.id;
      }
    }
    if (!account) {
      account = this.accountsRepository.create({
        guestId: guest.id,
        email,
        passwordHash: null,
        status: 'pending',
        profileKey,
        isOrganizer: false,
        lastLoginAt: null,
        lastLoginIp: '',
      });
    } else {
      if (email) account.email = email;
      account.profileKey = profileKey;
    }
    await this.accountsRepository.save(account);
  }

  async reconcileGuestAccounts(guests: GuestEntity[]): Promise<void> {
    for (const guest of guests) await this.syncGuestAccount(guest);
    const validGuestIds = new Set(guests.map(guest => guest.id));
    const guestAccounts = await this.accountsRepository.find({ where: { isOrganizer: false } });
    for (const account of guestAccounts) {
      if (account.guestId && !validGuestIds.has(account.guestId)) {
        account.status = 'disabled';
        await this.accountsRepository.save(account);
        await this.sessionsRepository.update({ accountId: account.id, revokedAt: IsNull() }, { revokedAt: new Date() });
      }
    }
  }

  async listAccounts(): Promise<Array<Record<string, unknown>>> {
    const [accounts, guests] = await Promise.all([
      this.accountsRepository.find({ order: { email: 'ASC' } }),
      this.guestsRepository.find(),
    ]);
    const guestById = new Map(guests.map(guest => [guest.id, guest]));
    return accounts.map(account => {
      const guest = account.guestId ? guestById.get(account.guestId) : undefined;
      return {
        id: account.id,
        guestId: account.guestId,
        email: account.email,
        status: account.status,
        profileKey: account.profileKey,
        isOrganizer: account.isOrganizer,
        lastLoginAt: account.lastLoginAt,
        name: guest ? `${guest.firstName} ${guest.lastName}`.trim() : 'Organisateur principal',
      };
    });
  }

  async enableGuestAccount(guestId: string): Promise<AccountEntity> {
    const guest = await this.guestsRepository.findOne({ where: { id: guestId } });
    if (!guest) throw new NotFoundException('Invité introuvable.');
    const email = normalizeEmail(guest.email);
    this.assertUsableEmail(email);
    const duplicate = await this.accountsRepository.findOne({ where: { email } });
    if (duplicate && duplicate.guestId !== guest.id) {
      throw new ConflictException('Cette adresse e-mail est déjà utilisée.');
    }
    let account = await this.accountsRepository.createQueryBuilder('account')
      .addSelect('account.passwordHash')
      .where('account.guestId = :guestId', { guestId })
      .getOne();
    if (!account) {
      account = this.accountsRepository.create({
        guestId,
        email,
        passwordHash: null,
        status: 'pending',
        profileKey: profileForOrganizationRole(guest.organizationRole),
        isOrganizer: false,
        lastLoginAt: null,
        lastLoginIp: '',
      });
    } else if (account.status === 'disabled') {
      account.status = account.passwordHash ? 'active' : 'pending';
    }
    return this.accountsRepository.save(account);
  }

  async setAccountStatus(accountId: string, status: 'pending' | 'active' | 'disabled'): Promise<void> {
    const account = await this.accountsRepository.createQueryBuilder('account')
      .addSelect('account.passwordHash')
      .where('account.id = :accountId', { accountId })
      .getOne();
    if (!account) throw new NotFoundException('Compte introuvable.');
    if (account.isOrganizer && status === 'disabled') {
      throw new BadRequestException("Le compte organisateur principal ne peut pas être désactivé.");
    }
    if (status === 'active' && !account.passwordHash) {
      throw new BadRequestException("Ce compte doit d'abord être activé par son titulaire.");
    }
    if (status === 'pending') account.passwordHash = null;
    account.status = status;
    await this.accountsRepository.save(account);
    if (status !== 'active') {
      await this.sessionsRepository.update({ accountId, revokedAt: IsNull() }, { revokedAt: new Date() });
    }
  }

  async resetAccount(accountId: string, newPassword?: string): Promise<void> {
    const account = await this.accountsRepository.createQueryBuilder('account')
      .addSelect('account.passwordHash')
      .where('account.id = :accountId', { accountId })
      .getOne();
    if (!account) throw new NotFoundException('Compte introuvable.');
    if (account.isOrganizer && !newPassword) {
      throw new BadRequestException("Le compte organisateur principal ne peut pas être remis en attente.");
    }
    if (newPassword) {
      account.passwordHash = await this.passwords.hash(newPassword);
      account.status = 'active';
    } else {
      account.passwordHash = null;
      account.status = 'pending';
    }
    await this.accountsRepository.save(account);
    await this.sessionsRepository.update({ accountId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async listProfiles(): Promise<AccessProfileEntity[]> {
    return this.profilesRepository.find({ relations: { permissions: true }, order: { name: 'ASC' } });
  }

  async updateProfile(profileKey: AccessProfileKey, body: { name?: string; permissions?: Partial<Record<SectionKey, { canView: boolean; canEdit: boolean }>> }): Promise<AccessProfileEntity> {
    const profile = await this.profilesRepository.findOne({ where: { key: profileKey } });
    if (!profile) throw new NotFoundException('Profil introuvable.');
    if (body.name?.trim()) profile.name = body.name.trim();
    await this.profilesRepository.save(profile);
    for (const section of SECTION_KEYS) {
      const requested = body.permissions?.[section];
      if (!requested) continue;
      const forcedOrganizer = profileKey === 'organizer';
      await this.permissionsRepository.upsert({
        profileKey,
        section,
        canView: forcedOrganizer || Boolean(requested.canView),
        canEdit: forcedOrganizer || (Boolean(requested.canView) && Boolean(requested.canEdit)),
      }, ['profileKey', 'section']);
    }
    return (await this.profilesRepository.findOne({ where: { key: profileKey }, relations: { permissions: true } }))!;
  }

  serializeAccount(account: AccountEntity): Record<string, unknown> {
    const permissions = Object.fromEntries(SECTION_KEYS.map(section => {
      const permission = account.profile?.permissions?.find(item => item.section === section);
      return [section, {
        canView: account.isOrganizer || Boolean(permission?.canView),
        canEdit: account.isOrganizer || Boolean(permission?.canEdit),
      }];
    }));
    return {
      id: account.id,
      guestId: account.guestId,
      email: account.email,
      profileKey: account.profileKey,
      isOrganizer: account.isOrganizer,
      permissions,
    };
  }

  async loadAccountForResponse(accountId: string): Promise<AccountEntity> {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId },
      relations: { profile: { permissions: true } },
    });
    if (!account) throw new UnauthorizedException();
    return account;
  }

  async setupStatus(): Promise<{ configured: boolean }> {
    const count = await this.accountsRepository.count({ where: { isOrganizer: true } });
    return { configured: count > 0 };
  }

  private async accountWithPassword(email: string): Promise<AccountEntity | null> {
    return this.accountsRepository.createQueryBuilder('account')
      .addSelect('account.passwordHash')
      .leftJoinAndSelect('account.profile', 'profile')
      .leftJoinAndSelect('profile.permissions', 'permissions')
      .where('account.email = :email', { email })
      .getOne();
  }

  private async seedProfiles(): Promise<void> {
    for (const key of Object.keys(PROFILE_NAMES) as AccessProfileKey[]) {
      await this.profilesRepository.upsert({ key, name: PROFILE_NAMES[key] }, ['key']);
      for (const section of SECTION_KEYS) {
        const existing = await this.permissionsRepository.findOne({ where: { profileKey: key, section } });
        if (existing) continue;
        const [canView, canEdit] = DEFAULT_PERMISSIONS[key][section] ?? [false, false];
        await this.permissionsRepository.save(this.permissionsRepository.create({ profileKey: key, section, canView, canEdit }));
      }
    }
  }

  private async ensureBootstrapOrganizer(): Promise<void> {
    const email = normalizeEmail(this.config.get<string>('BOOTSTRAP_ORGANIZER_EMAIL', ''));
    const password = this.config.get<string>('BOOTSTRAP_ORGANIZER_PASSWORD', '');
    if (!email || !password) return;
    let account = await this.accountsRepository.findOne({ where: { isOrganizer: true } });
    if (account) return;
    account = this.accountsRepository.create({
      guestId: null,
      email,
      passwordHash: await this.passwords.hash(password),
      status: 'active',
      profileKey: 'organizer',
      isOrganizer: true,
      lastLoginAt: null,
      lastLoginIp: '',
    });
    await this.accountsRepository.save(account);
    this.logger.log('Compte organisateur initial créé depuis la configuration.');
  }

  private validateProductionConfiguration(): void {
    if (this.config.get<string>('NODE_ENV') !== 'production') return;
    const required = ['SESSION_SECRET', 'PRIVATE_EVENT_CODE', 'BOOTSTRAP_ORGANIZER_EMAIL', 'BOOTSTRAP_ORGANIZER_PASSWORD'];
    const missing = required.filter(key => !this.config.get<string>(key));
    if (missing.length) throw new Error(`Configuration de sécurité manquante: ${missing.join(', ')}`);
    if ((this.config.get<string>('SESSION_SECRET') ?? '').length < 32) {
      throw new Error('SESSION_SECRET doit contenir au moins 32 caractères.');
    }
    if ((this.config.get<string>('PRIVATE_EVENT_CODE') ?? '').length < 8) {
      throw new Error('PRIVATE_EVENT_CODE doit contenir au moins 8 caractères.');
    }
  }

  private hashSessionToken(token: string): string {
    const secret = this.config.get<string>('SESSION_SECRET', 'local-development-session-secret');
    return createHmac('sha256', secret).update(token).digest('hex');
  }

  private hashCsrfToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private readCookie(header: string, name: string): string | null {
    for (const part of header.split(';')) {
      const [key, ...value] = part.trim().split('=');
      if (key === name) return decodeURIComponent(value.join('='));
    }
    return null;
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private assertUsableEmail(email: string): void {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      throw new BadRequestException('Adresse e-mail invalide.');
    }
  }
}
