import { AssigneeId, EventKey, Guest, GuestCategory, Rsvp, ThemeKey } from '../data/types';
import { CATS, EVENT_LABELS, RSVP_LABELS } from '../data/seed';

export interface ThemeDef {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentFg: string;
  badgeBg: string;
  name: string;
}

export const THEMES: Record<ThemeKey, ThemeDef> = {
  blanc: {
    bg: '#F8F8F6',
    surface: '#FFFFFF',
    surfaceAlt: '#F2F2EF',
    border: '#E5E4DF',
    text: '#111110',
    muted: '#8A8A80',
    accent: '#111110',
    accentFg: '#FFFFFF',
    badgeBg: '#EBEBE8',
    name: 'Blanc',
  },
  nuit: {
    bg: '#0C0C0A',
    surface: '#161614',
    surfaceAlt: '#1E1E1B',
    border: '#2C2C28',
    text: '#EEE9E1',
    muted: '#A3A39A',
    accent: '#EEE9E1',
    accentFg: '#0C0C0A',
    badgeBg: '#222220',
    name: 'Nuit',
  },
  ivoire: {
    bg: '#F1EBE0',
    surface: '#FAF6EE',
    surfaceAlt: '#ECE4D4',
    border: '#D8CFBC',
    text: '#211C10',
    muted: '#7A7060',
    accent: '#211C10',
    accentFg: '#FAF6EE',
    badgeBg: '#E4DBCA',
    name: 'Ivoire',
  },
};

export type PageId = 'dashboard' | 'guests' | 'housing' | 'seating' | 'budget' | 'todos' | 'vendors';
export type IconName = 'dashboard' | 'guests' | 'housing' | 'seating' | 'budget' | 'todo' | 'vendors' | 'plus' | 'x' | 'edit' | 'trash' | 'bed' | 'chevron' | 'check';

export const NAV_ITEMS: { id: PageId; label: string; icon: IconName }[] = [
  { id: 'dashboard', label: "Vue d'ensemble", icon: 'dashboard' },
  { id: 'guests', label: 'Invités', icon: 'guests' },
  { id: 'vendors', label: 'Prestataires', icon: 'vendors' },
  { id: 'housing', label: 'Hébergement', icon: 'housing' },
  { id: 'seating', label: 'Plan de table', icon: 'seating' },
  { id: 'budget', label: 'Budget', icon: 'budget' },
  { id: 'todos', label: 'À faire', icon: 'todo' },
];

export const THEME_KEYS: ThemeKey[] = ['blanc', 'nuit', 'ivoire'];

export const CATEGORY_OPTIONS = (Object.keys(CATS) as GuestCategory[]).map(value => ({
  value,
  label: CATS[value].label,
  short: CATS[value].short,
}));

export const RSVP_OPTIONS = (Object.keys(RSVP_LABELS) as Rsvp[]).map(value => ({
  value,
  label: RSVP_LABELS[value],
}));

export const EVENT_OPTIONS = (Object.keys(EVENT_LABELS) as EventKey[]).map(value => ({
  value,
  label: EVENT_LABELS[value],
}));

export const ASSIGNEE_OPTIONS: { value: AssigneeId; label: string }[] = [
  { value: 'marie', label: 'Marié' },
  { value: 'elle', label: 'Elle' },
  { value: 'famille', label: 'Famille' },
  { value: 'prestataire', label: 'Prestataire' },
];

export const fmtCurrency = (amount: number): string =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);

export const fmtDate = (date: string): string =>
  date ? new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const fmtShortDate = (date: string): string =>
  date ? new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';

export const emptyGuest = (): Guest => ({
  id: Math.random().toString(36).slice(2, 9),
  firstName: '',
  lastName: '',
  category: 'amis',
  rsvp: 'pending',
  hasPlusOne: false,
  plusOneName: '',
  kids: [],
  dietary: '',
  events: ['ceremony', 'dinner'],
  transport: '',
  notes: '',
});

export const cloneGuest = (guest: Guest): Guest => ({
  ...guest,
  events: [...guest.events],
  kids: guest.kids.map(kid => ({ ...kid })),
});
