import { Vendor, VendorCategoryKey, VendorDetails, VendorStatus } from './types';

export interface VendorFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'boolean' | 'select';
  options?: { value: string; label: string }[];
  default?: string | number | boolean;
  hint?: string;
}

export interface VendorCategoryDef {
  key: VendorCategoryKey;
  label: string;
  fields: VendorFieldDef[];
}

export const VENDOR_STATUS_OPTIONS: { value: VendorStatus; label: string; tone: 'neutral' | 'progress' | 'positive' | 'muted' }[] = [
  { value: 'a-contacter', label: 'À contacter', tone: 'neutral' },
  { value: 'contacte', label: 'Contacté', tone: 'neutral' },
  { value: 'devis-demande', label: 'Devis demandé', tone: 'progress' },
  { value: 'devis-recu', label: 'Devis reçu', tone: 'progress' },
  { value: 'reserve', label: 'Réservé', tone: 'positive' },
  { value: 'acompte-paye', label: 'Acompte payé', tone: 'positive' },
  { value: 'solde-paye', label: 'Solde payé', tone: 'positive' },
  { value: 'ecarte', label: 'Écarté', tone: 'muted' },
];

export const VENDOR_CATEGORIES: VendorCategoryDef[] = [
  {
    key: 'traiteur',
    label: 'Traiteur',
    fields: [
      { key: 'cuisineStyle', label: 'Style de cuisine', type: 'text', default: '' },
      { key: 'pricePerGuest', label: 'Prix par invité (€)', type: 'number', default: 0 },
      { key: 'minGuests', label: 'Minimum invités', type: 'number', default: 0 },
      { key: 'maxGuests', label: 'Maximum invités', type: 'number', default: 0 },
      { key: 'tastingDate', label: 'Date dégustation', type: 'date', default: '' },
      { key: 'cocktailIncluded', label: 'Cocktail inclus', type: 'boolean', default: false },
      { key: 'brunchIncluded', label: 'Brunch inclus', type: 'boolean', default: false },
      { key: 'weddingCakeIncluded', label: 'Pièce montée incluse', type: 'boolean', default: false },
      { key: 'childMenu', label: 'Menu enfant', type: 'boolean', default: false },
      { key: 'vegetarianOption', label: 'Option végétarienne', type: 'boolean', default: false },
      { key: 'dietaryAccommodations', label: 'Régimes spéciaux', type: 'text', default: '', hint: 'Sans gluten, halal, casher…' },
      { key: 'serviceStaffIncluded', label: 'Personnel de service inclus', type: 'boolean', default: false },
      { key: 'serviceStaffCount', label: 'Nombre de serveurs', type: 'number', default: 0 },
      { key: 'beveragePackage', label: 'Forfait boissons', type: 'text', default: '' },
      { key: 'corkageFee', label: 'Droit de bouchon (€)', type: 'number', default: 0 },
    ],
  },
  {
    key: 'photographe',
    label: 'Photographe',
    fields: [
      { key: 'style', label: 'Style', type: 'text', default: '', hint: 'Reportage, posé, fine-art…' },
      { key: 'hoursCovered', label: 'Heures de couverture', type: 'number', default: 0 },
      { key: 'photographerCount', label: 'Nombre de photographes', type: 'number', default: 1 },
      { key: 'preWeddingShoot', label: 'Séance engagement', type: 'boolean', default: false },
      { key: 'editedPhotosCount', label: 'Photos retouchées', type: 'number', default: 0 },
      { key: 'rawPhotosIncluded', label: 'Photos brutes incluses', type: 'boolean', default: false },
      { key: 'albumIncluded', label: 'Album inclus', type: 'boolean', default: false },
      { key: 'albumDetails', label: 'Détails album', type: 'text', default: '' },
      { key: 'onlineGallery', label: 'Galerie en ligne', type: 'boolean', default: true },
      { key: 'usbDelivery', label: 'Livraison USB', type: 'boolean', default: false },
      { key: 'deliveryWeeks', label: 'Délai de livraison (semaines)', type: 'number', default: 0 },
      { key: 'travelFee', label: 'Frais de déplacement (€)', type: 'number', default: 0 },
    ],
  },
  {
    key: 'videaste',
    label: 'Vidéaste',
    fields: [
      { key: 'hoursCovered', label: 'Heures de couverture', type: 'number', default: 0 },
      { key: 'cameraCount', label: 'Nombre de caméras', type: 'number', default: 1 },
      { key: 'droneIncluded', label: 'Drone inclus', type: 'boolean', default: false },
      { key: 'fullCeremonyVideo', label: 'Cérémonie complète', type: 'boolean', default: false },
      { key: 'highlightReelMinutes', label: 'Durée du film (min)', type: 'number', default: 0 },
      { key: 'sameDayEdit', label: 'Montage same-day', type: 'boolean', default: false },
      { key: 'rawFootageIncluded', label: 'Rushes inclus', type: 'boolean', default: false },
      { key: 'deliveryFormat', label: 'Format de livraison', type: 'text', default: '' },
      { key: 'deliveryWeeks', label: 'Délai de livraison (semaines)', type: 'number', default: 0 },
      { key: 'travelFee', label: 'Frais de déplacement (€)', type: 'number', default: 0 },
    ],
  },
  {
    key: 'dj',
    label: 'DJ',
    fields: [
      { key: 'hoursOfPerformance', label: 'Heures de prestation', type: 'number', default: 0 },
      { key: 'setupTime', label: 'Installation', type: 'text', default: '', hint: '"1h avant"' },
      { key: 'equipmentIncluded', label: 'Équipement inclus', type: 'textarea', default: '' },
      { key: 'micsForSpeeches', label: 'Micros pour discours', type: 'number', default: 0 },
      { key: 'backupEquipment', label: 'Matériel de secours', type: 'boolean', default: false },
      { key: 'mcServices', label: 'Animation / MC', type: 'boolean', default: false },
      { key: 'playlistCollaboration', label: 'Playlist collaborative', type: 'boolean', default: false },
      { key: 'genres', label: 'Genres musicaux', type: 'text', default: '' },
      { key: 'partyEndTime', label: 'Heure de fin', type: 'text', default: '', hint: 'ex. 02:00' },
    ],
  },
  {
    key: 'musique',
    label: 'Musique live',
    fields: [
      { key: 'ensembleType', label: "Type d'ensemble", type: 'text', default: '', hint: 'Quatuor, orchestre, soliste…' },
      { key: 'musicianCount', label: 'Nombre de musiciens', type: 'number', default: 1 },
      { key: 'hoursOfPerformance', label: 'Heures de prestation', type: 'number', default: 0 },
      { key: 'forCeremony', label: 'Pour la cérémonie', type: 'boolean', default: false },
      { key: 'forCocktail', label: 'Pour le cocktail', type: 'boolean', default: false },
      { key: 'forDinner', label: 'Pour le dîner', type: 'boolean', default: false },
      { key: 'repertoire', label: 'Répertoire', type: 'textarea', default: '' },
      { key: 'equipmentProvided', label: 'Équipement fourni', type: 'boolean', default: false },
    ],
  },
  {
    key: 'fleuriste',
    label: 'Fleuriste',
    fields: [
      { key: 'bouquetMariee', label: 'Bouquet de la mariée', type: 'boolean', default: false },
      { key: 'bouquetDemoiselles', label: "Bouquets demoiselles d'honneur", type: 'number', default: 0 },
      { key: 'boutonnieres', label: 'Boutonnières', type: 'number', default: 0 },
      { key: 'centerpiecesCount', label: 'Centres de table', type: 'number', default: 0 },
      { key: 'ceremonyArch', label: 'Arche de cérémonie', type: 'boolean', default: false },
      { key: 'petalsForAisle', label: 'Pétales allée', type: 'boolean', default: false },
      { key: 'palette', label: 'Palette', type: 'text', default: '' },
      { key: 'flowerTypes', label: 'Types de fleurs', type: 'textarea', default: '' },
      { key: 'deliveryIncluded', label: 'Livraison incluse', type: 'boolean', default: false },
      { key: 'setupIncluded', label: 'Installation incluse', type: 'boolean', default: false },
      { key: 'cleanupIncluded', label: 'Nettoyage inclus', type: 'boolean', default: false },
      { key: 'rentalItems', label: 'Éléments en location', type: 'text', default: '', hint: 'Vases, supports, chandeliers…' },
    ],
  },
  {
    key: 'location-vaisselle',
    label: 'Location de vaisselle',
    fields: [
      { key: 'placeSettings', label: 'Couverts (nombre)', type: 'number', default: 0 },
      { key: 'collection', label: 'Gamme / collection', type: 'text', default: '' },
      { key: 'platesIncluded', label: 'Assiettes', type: 'boolean', default: true },
      { key: 'glassesIncluded', label: 'Verres', type: 'boolean', default: true },
      { key: 'cutleryIncluded', label: 'Couverts', type: 'boolean', default: true },
      { key: 'napkinsIncluded', label: 'Serviettes', type: 'boolean', default: false },
      { key: 'napkinColor', label: 'Couleur serviettes', type: 'text', default: '' },
      { key: 'tableclothsIncluded', label: 'Nappes', type: 'boolean', default: false },
      { key: 'tableclothColor', label: 'Couleur nappes', type: 'text', default: '' },
      { key: 'deliveryIncluded', label: 'Livraison incluse', type: 'boolean', default: false },
      { key: 'pickupIncluded', label: 'Reprise incluse', type: 'boolean', default: false },
      { key: 'cleaningIncluded', label: 'Vaisselle propre rendue', type: 'boolean', default: false },
      { key: 'breakageDeposit', label: 'Caution casse (€)', type: 'number', default: 0 },
    ],
  },
  {
    key: 'decoration',
    label: 'Décoration',
    fields: [
      { key: 'theme', label: 'Thème', type: 'text', default: '' },
      { key: 'itemsProvided', label: 'Éléments fournis', type: 'textarea', default: '' },
      { key: 'rentalVsPurchase', label: 'Mode', type: 'select', default: 'location', options: [
        { value: 'location', label: 'Location' },
        { value: 'achat', label: 'Achat' },
        { value: 'mixte', label: 'Mixte' },
      ]},
      { key: 'setupIncluded', label: 'Installation incluse', type: 'boolean', default: false },
      { key: 'breakdownIncluded', label: 'Démontage inclus', type: 'boolean', default: false },
      { key: 'storageBetweenEvents', label: 'Stockage entre événements', type: 'boolean', default: false },
      { key: 'insuranceRequired', label: 'Assurance demandée', type: 'boolean', default: false },
    ],
  },
  {
    key: 'coiffure-maquillage',
    label: 'Coiffure & Maquillage',
    fields: [
      { key: 'serviceType', label: 'Prestation', type: 'select', default: 'les-deux', options: [
        { value: 'coiffure', label: 'Coiffure' },
        { value: 'maquillage', label: 'Maquillage' },
        { value: 'les-deux', label: 'Les deux' },
      ]},
      { key: 'trialDate', label: 'Date essai', type: 'date', default: '' },
      { key: 'trialIncluded', label: 'Essai inclus', type: 'boolean', default: false },
      { key: 'peopleCount', label: 'Personnes prises en charge', type: 'number', default: 1 },
      { key: 'travelsToVenue', label: 'Se déplace au lieu', type: 'boolean', default: false },
      { key: 'touchUpsDuringDay', label: 'Retouches dans la journée', type: 'boolean', default: false },
      { key: 'hypoallergenicProducts', label: 'Produits hypoallergéniques', type: 'boolean', default: false },
      { key: 'productsBrand', label: 'Marques utilisées', type: 'text', default: '' },
      { key: 'arrivalTime', label: "Heure d'arrivée", type: 'text', default: '' },
    ],
  },
  {
    key: 'voiture',
    label: 'Voiture',
    fields: [
      { key: 'vehicleModel', label: 'Modèle', type: 'text', default: '' },
      { key: 'vehicleYear', label: 'Année', type: 'number', default: 0 },
      { key: 'vehicleCount', label: 'Nombre de véhicules', type: 'number', default: 1 },
      { key: 'driverIncluded', label: 'Chauffeur inclus', type: 'boolean', default: false },
      { key: 'decorationIncluded', label: 'Décoration incluse', type: 'boolean', default: false },
      { key: 'hoursIncluded', label: 'Heures incluses', type: 'number', default: 0 },
      { key: 'itinerary', label: 'Itinéraire', type: 'textarea', default: '' },
      { key: 'pickupTime', label: 'Heure de prise en charge', type: 'text', default: '' },
      { key: 'withChampagne', label: 'Champagne à bord', type: 'boolean', default: false },
    ],
  },
  {
    key: 'officiant',
    label: 'Officiant',
    fields: [
      { key: 'ceremonyType', label: 'Type de cérémonie', type: 'select', default: 'laique', options: [
        { value: 'civile', label: 'Civile' },
        { value: 'religieuse', label: 'Religieuse' },
        { value: 'laique', label: 'Laïque' },
        { value: 'spirituelle', label: 'Spirituelle' },
      ]},
      { key: 'rehearsalIncluded', label: 'Répétition incluse', type: 'boolean', default: false },
      { key: 'rehearsalDate', label: 'Date répétition', type: 'date', default: '' },
      { key: 'preMeetings', label: 'Rendez-vous préparatoires', type: 'number', default: 0 },
      { key: 'ceremonyDurationMinutes', label: 'Durée cérémonie (min)', type: 'number', default: 0 },
      { key: 'customVows', label: 'Vœux personnalisés', type: 'boolean', default: false },
      { key: 'scenarioPersonalized', label: 'Scénario personnalisé', type: 'boolean', default: false },
      { key: 'multilingual', label: 'Multilingue', type: 'boolean', default: false },
      { key: 'languages', label: 'Langues', type: 'text', default: '' },
      { key: 'soundSystemProvided', label: 'Sono fournie', type: 'boolean', default: false },
    ],
  },
];

const CATEGORY_BY_KEY = new Map(VENDOR_CATEGORIES.map(c => [c.key, c]));

export const getVendorCategory = (key: VendorCategoryKey): VendorCategoryDef =>
  CATEGORY_BY_KEY.get(key) ?? VENDOR_CATEGORIES[0];

export const defaultDetailsFor = (key: VendorCategoryKey): VendorDetails => {
  const cat = CATEGORY_BY_KEY.get(key);
  if (!cat) return {};
  const out: VendorDetails = {};
  for (const f of cat.fields) {
    out[f.key] = f.default ?? (f.type === 'boolean' ? false : f.type === 'number' ? 0 : '');
  }
  return out;
};

export const mergeDetails = (key: VendorCategoryKey, stored: VendorDetails | null | undefined): VendorDetails => {
  return { ...defaultDetailsFor(key), ...(stored ?? {}) };
};

export const emptyVendor = (category: VendorCategoryKey): Vendor => ({
  id: Math.random().toString(36).slice(2, 9),
  category,
  name: '',
  contactName: '',
  phone: '',
  email: '',
  website: '',
  instagram: '',
  address: '',
  priceEstimate: 0,
  priceFinal: 0,
  depositAmount: 0,
  depositPaid: false,
  balanceDueDate: '',
  status: 'a-contacter',
  meetingDate: '',
  contractSigned: false,
  contractUrl: '',
  rating: 0,
  notes: '',
  details: defaultDetailsFor(category),
});
