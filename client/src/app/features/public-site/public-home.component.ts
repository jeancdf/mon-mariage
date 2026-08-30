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
  driveLabel: string;
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
      title: 'Montcuq',
      photo: '/lot/montcuq.jpg',
      driveLabel: 'sur place',
      blurb: 'Le village de la cérémonie, sa tour et ses cafés. Un détour tout près, le temps d’un café sur la place.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Montcuq-en-Quercy-Blanc',
    },
    {
      title: 'Marché de Montcuq',
      photo: '/lot/marche.jpg',
      driveLabel: 'sur place',
      blurb: 'Tous les dimanches matin sur la place, un des plus beaux marchés du Lot. En été, un petit marché le jeudi aussi.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Place+de+la+République,+46800+Montcuq-en-Quercy-Blanc',
    },
    {
      title: 'Padel de Montcuq',
      photo: '/lot/padel.jpg',
      driveLabel: '5 min',
      blurb: 'Un court en extérieur au complexe sportif, à deux pas du village. Idéal pour un match entre amis.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Complexe+sportif+Belle+Dent,+Montcuq-en-Quercy-Blanc',
    },
    {
      title: 'Accrobranche',
      photo: '/lot/accrobranche.jpg',
      driveLabel: '30 min',
      blurb: 'Parcours dans les arbres au Cap Nature de Pradines, au bord du Lot. Tyroliennes et ponts de singe, dès 2 ans. Réservation conseillée.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Cap+Nature,+Chemin+de+l%27Ile,+46090+Pradines',
    },
    {
      title: 'Lac de Montcuq',
      photo: '/lot/lac-montcuq.jpg',
      driveLabel: '10 min',
      blurb: 'Baignade et balade au bord de l’eau. Un coin calme pour se poser entre deux visites.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Lac+de+Montcuq',
    },
    {
      title: 'Dégustations',
      photo: '/lot/degustation.jpg',
      driveLabel: '15 min',
      blurb: 'Caves et domaines autour de Montcuq pour goûter le malbec de Cahors. Plusieurs vignerons vendent aussi au marché du dimanche.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Clos+Siguier,+Bagat-en-Quercy',
    },
    {
      title: 'Rocamadour',
      photo: '/lot/rocamadour.jpg',
      driveLabel: '1 h 30',
      blurb: 'Cité médiévale accrochée à la falaise, haut lieu de pèlerinage. Un panorama unique sur le Quercy.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Rocamadour',
    },
    {
      title: 'Cahors et le Pont Valentré',
      photo: '/lot/pont-valentre.jpg',
      driveLabel: '35 min',
      blurb: 'La cité médiévale et son pont fortifié. Idéal pour une balade en ville et un verre de malbec.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Pont+Valentré,+Cahors',
    },
    {
      title: 'Canoë sur le Lot',
      photo: '/lot/riviere-lot.jpg',
      driveLabel: '50 min',
      blurb: 'Descente de la rivière entre falaises et villages, avec des départs vers Bouziès ou Saint-Cirq-Lapopie.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Bouziès',
    },
    {
      title: 'Saint-Cirq-Lapopie',
      photo: '/lot/saint-cirq.jpg',
      driveLabel: '55 min',
      blurb: 'Village perché au-dessus du Lot, classé parmi les plus beaux de France.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Saint-Cirq-Lapopie',
    },
    {
      title: 'Vignoble de Cahors',
      photo: '/lot/vignoble.jpg',
      driveLabel: '30 min',
      blurb: 'Les coteaux du malbec autour de Cahors : caves, paysages et dégustations.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Vignoble+de+Cahors',
    },
    {
      title: 'Gouffre de Padirac',
      photo: '/lot/padirac.jpg',
      driveLabel: '1 h 35',
      blurb: 'Descente en bateau dans une rivière souterraine, sous un gouffre de 103 mètres. Pensez à réserver en haute saison.',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Gouffre+de+Padirac',
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
