import type { Request } from 'express';
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

export interface AuthenticatedRequest extends Request {
  account: AccountEntity;
  session: SessionEntity;
}

