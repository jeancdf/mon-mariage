import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { SectionKey } from '../auth/auth.types';
import { WeddingStore } from '../data/store';
import { Guest } from '../data/types';
import { CommandPaletteComponent } from './command-palette.component';

const guest = (firstName: string, lastName: string): Guest => ({
  id: `${firstName}-${lastName}`,
  firstName,
  lastName,
  email: '',
  organizationRole: 'other',
  category: 'amis',
  rsvp: 'pending',
  hasPlusOne: false,
  plusOneName: '',
  kids: [],
  dietary: '',
  events: [],
  transport: '',
  notes: '',
});

describe('CommandPaletteComponent', () => {
  let router: { navigate: ReturnType<typeof vi.fn>; navigateByUrl: ReturnType<typeof vi.fn> };

  const createPalette = (sections: SectionKey[] | 'all', organizer = sections === 'all') => {
    router = { navigate: vi.fn(async () => true), navigateByUrl: vi.fn(async () => true) };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        {
          provide: AuthService,
          useValue: {
            can: (section: SectionKey) => sections === 'all' || sections.includes(section),
            isOrganizer: signal(organizer),
          },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new CommandPaletteComponent());
  };

  const labels = (options: { label: string }[]) => options.map(option => option.label);

  it('lists only the pages the account can access, without Administration for a non-organizer', () => {
    const palette = createPalette(['dashboard', 'budget', 'todos']);

    expect(labels(palette.pages())).toEqual(["Vue d'ensemble", 'Budget', 'À faire']);
  });

  it('lists every page plus Administration for an organizer', () => {
    const palette = createPalette('all');

    expect(labels(palette.pages())).toEqual([
      "Vue d'ensemble", 'Invités', 'Prestataires', 'Hébergement', 'Plan de table', 'Budget', 'À faire', 'Dernières semaines', 'Administration',
    ]);
  });

  it('shows no guests without the guests permission', () => {
    const palette = createPalette(['dashboard']);
    TestBed.inject(WeddingStore).guests.set([guest('Camille', 'Rousseau')]);

    palette.query.set('rous');

    expect(palette.guests()).toEqual([]);
  });

  it('matches pages and guests without case or accents', () => {
    const palette = createPalette('all');
    TestBed.inject(WeddingStore).guests.set([guest('Hélène', 'Rousseau'), guest('Julien', 'Vasseur')]);

    palette.query.set('hebergement');
    expect(labels(palette.pages())).toEqual(['Hébergement']);

    palette.query.set('HELENE');
    expect(labels(palette.guests())).toEqual(['Hélène Rousseau']);
  });

  it('caps guest results at 8, sorted by name', () => {
    const palette = createPalette('all');
    const names = ['Zoé', 'Yann', 'Xavier', 'Wanda', 'Victor', 'Ugo', 'Théo', 'Sarah', 'Romain', 'Quentin'];
    TestBed.inject(WeddingStore).guests.set(names.map(name => guest(name, 'Martin')));

    palette.query.set('martin');

    expect(labels(palette.guests())).toEqual([
      'Quentin Martin', 'Romain Martin', 'Sarah Martin', 'Théo Martin', 'Ugo Martin', 'Victor Martin', 'Wanda Martin', 'Xavier Martin',
    ]);
  });

  it('opens the guests page filtered on the activated guest', async () => {
    const palette = createPalette('all');
    TestBed.inject(WeddingStore).guests.set([guest('Camille', 'Rousseau')]);
    palette.query.set('camille');

    await palette.activate(palette.guests()[0]);

    expect(router.navigate).toHaveBeenCalledWith(['/invites'], { queryParams: { recherche: 'Camille Rousseau' } });
  });
});
