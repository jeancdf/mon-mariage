import type { AccountEntity } from './entities/account.entity';
import type { SessionEntity } from './entities/session.entity';

export const SECTION_KEYS = [
  'dashboard',
  'guests',
  'vendors',
  'housing',
  'seating',
  'budget',
  'todos',
  'final_weeks',
] as const;

export type SectionKey = typeof SECTION_KEYS[number];
export type PermissionLevel = 'view' | 'edit';
export type AccessProfileKey =
  | 'organizer'
  | 'parent'
  | 'sibling'
  | 'witness'
  | 'friend_cousin'
  | 'other';

export type AccountStatus = 'pending' | 'active' | 'disabled';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  ip?: string;
  account: AccountEntity;
  session: SessionEntity;
}

export interface CookieResponse {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
}
