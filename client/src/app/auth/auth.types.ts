export type SectionKey = 'dashboard' | 'guests' | 'vendors' | 'housing' | 'seating' | 'budget' | 'todos' | 'final_weeks';
export type AccessProfileKey = 'organizer' | 'parent' | 'sibling' | 'witness' | 'friend_cousin' | 'other';

export interface SectionPermission {
  canView: boolean;
  canEdit: boolean;
}

export interface AuthAccount {
  id: string;
  guestId: string | null;
  email: string;
  profileKey: AccessProfileKey;
  isOrganizer: boolean;
  permissions: Record<SectionKey, SectionPermission>;
}

export interface AuthResponse {
  account: AuthAccount;
  csrfToken: string;
}

