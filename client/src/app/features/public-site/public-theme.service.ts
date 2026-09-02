import { Injectable, computed, signal } from '@angular/core';
import { THEMES, ThemeDef } from '../../shared/wedding-utils';

export type PublicThemeKey = 'ivoire' | 'nuit';

const STORAGE_KEY = 'mm-public-theme';

const isPublicThemeKey = (value: string | null): value is PublicThemeKey =>
  value === 'ivoire' || value === 'nuit';

const prefersDark = (): boolean => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

const readStored = (): PublicThemeKey | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isPublicThemeKey(value) ? value : null;
  } catch {
    return null;
  }
};

const initialKey = (): PublicThemeKey => readStored() ?? (prefersDark() ? 'nuit' : 'ivoire');

@Injectable({ providedIn: 'root' })
export class PublicThemeService {
  readonly key = signal<PublicThemeKey>(initialKey());
  readonly theme = computed<ThemeDef>(() => THEMES[this.key()]);
  readonly isDark = computed(() => this.key() === 'nuit');
  readonly toggleLabel = computed(() => (this.isDark() ? 'Mode clair' : 'Mode sombre'));

  toggle(): void {
    this.set(this.isDark() ? 'ivoire' : 'nuit');
  }

  private set(key: PublicThemeKey): void {
    this.key.set(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      /* ignore quota / private mode */
    }
  }
}
