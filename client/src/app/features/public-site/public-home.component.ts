import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicApiService, PublicSiteInfo } from '../../data/public-api.service';
import { PublicThemeService } from './public-theme.service';
import { PublicThemeToggleComponent } from './public-theme-toggle.component';

export interface PublicVenue {
  title: string;
  time?: string;
  place: string;
  address: string;
  mapsUrl: string;
}

export interface LotSpot {
  title: string;
  photo: string;
  blurb: string;
  mapsUrl: string;
}

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [RouterLink, PublicThemeToggleComponent],
  templateUrl: './public-home.component.html',
})
export class PublicHomeComponent {
  private readonly api = inject(PublicApiService);
  readonly publicTheme = inject(PublicThemeService);
  readonly site = signal<PublicSiteInfo | null>(null);
  readonly error = signal('');
  readonly loading = signal(true);

  readonly venues: PublicVenue[] = [
    {
      title: 'Cérémonie',
      time: '14h30',
      place: 'Église',
      address: '5 Pl. de la Halle aux Grains, 46800 Montcuq-en-Quercy-Blanc',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=5+Pl.+de+la+Halle+aux+Grains,+46800+Montcuq-en-Quercy-Blanc',
    },
    {
      title: 'Cocktail, dîner & soirée',
      place: 'Château d’Escayrac',
      address: '250 Chem. du Château d’Escayrac, 46800 Lendou-en-Quercy',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=250+Chem.+du+Ch%C3%A2teau+d%27Escayrac,+46800+Lendou-en-Quercy',
    },
  ];

  readonly lotSpots: LotSpot[] = [
    {
      title: 'Saint-Cirq-Lapopie',
      photo: '/lot/saint-cirq.jpg',
      blurb: 'Village perché au-dessus du Lot, classé parmi les plus beaux de France. Comptez environ 45 minutes depuis Montcuq.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Saint-Cirq-Lapopie',
    },
    {
      title: 'Cahors et le Pont Valentré',
      photo: '/lot/pont-valentre.jpg',
      blurb: 'La cité médiévale et son pont fortifié, à environ 35 minutes. Idéal pour une balade en ville et un verre de malbec.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Pont+Valentré,+Cahors',
    },
    {
      title: 'Canoë sur le Lot',
      photo: '/lot/riviere-lot.jpg',
      blurb: 'Descente de la rivière entre falaises et villages, avec des départs vers Bouziès ou Saint-Cirq-Lapopie.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Bouziès',
    },
    {
      title: 'Montcuq',
      photo: '/lot/montcuq.jpg',
      blurb: 'Le village de la cérémonie, sa tour et son marché du lundi. Un détour tout près, le temps d’un café sur la place.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Montcuq-en-Quercy-Blanc',
    },
    {
      title: 'Vignoble de Cahors',
      photo: '/lot/vignoble.jpg',
      blurb: 'Les coteaux du malbec autour de Cahors : caves, paysages et dégustations à quelques kilomètres.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Vignoble+de+Cahors',
    },
    {
      title: 'Lac de Montcuq',
      photo: '/lot/lac-montcuq.jpg',
      blurb: 'Baignade et balade au bord de l’eau, à deux pas du village. Un coin calme pour se poser entre deux visites.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Lac+de+Montcuq',
    },
  ];

  readonly coupleLabel = computed(() => {
    const names = this.site()?.coupleNames ?? [];
    if (names.length >= 2) return `${names[0]} & ${names[1]}`;
    if (names.length === 1) return names[0];
    return '';
  });

  readonly dateLabel = computed(() => {
    const date = this.site()?.weddingDate;
    if (!date) return '';
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .format(new Date(`${date}T12:00:00`));
  });

  constructor() {
    void this.load();
  }

  hideBrokenPhoto(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img) img.hidden = true;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.site.set(await this.api.loadSite());
      this.error.set('');
    } catch {
      this.error.set('Impossible de charger les informations du mariage.');
    } finally {
      this.loading.set(false);
    }
  }
}
