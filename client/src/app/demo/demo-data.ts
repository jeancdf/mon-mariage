import { AdminAccount, AdminProfile } from '../data/admin-api.service';
import { AuthAccount, SectionKey, SectionPermission } from '../auth/auth.types';
import { EventConfiguration } from '../data/event-config.service';
import { FinalWeeksMeal, FinalWeeksTask, MealKind } from '../data/final-weeks-api.service';
import { Budget, Guest, House, Table, TodoGroup, Vendor, VendorCategoryKey, VendorDetails } from '../data/types';
import { defaultDetailsFor } from '../data/vendor-categories';

/** Presence record keyed by guest person id, mirroring the server `presences` table. */
export interface DemoPresence {
  arrivalAt: string | null;
  departureAt: string | null;
  mealSelections: Record<string, MealKind[]>;
}

export interface DemoDataset {
  account: AuthAccount;
  eventConfig: EventConfiguration;
  guests: Guest[];
  houses: House[];
  tables: Table[];
  budget: Budget;
  todos: TodoGroup[];
  vendors: Vendor[];
  presences: Record<string, DemoPresence>;
  meals: FinalWeeksMeal[];
  finalTasks: FinalWeeksTask[];
  accounts: AdminAccount[];
  profiles: AdminProfile[];
}

const DEMO_SECTIONS: SectionKey[] = [
  'dashboard', 'guests', 'vendors', 'housing', 'seating', 'budget', 'todos', 'final_weeks',
];

const localDate = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const shiftDays = (date: string, offset: number): string => {
  const shifted = new Date(`${date}T12:00:00`);
  shifted.setDate(shifted.getDate() + offset);
  return localDate(shifted);
};

/** Local wall-clock time on a given day, serialized the way the API returns timestamps. */
const at = (date: string, time: string): string => new Date(`${date}T${time}:00`).toISOString();

// The dataset is generated relative to the current day so the demo always lands
// mid-crunch: four days before the wedding, inside the daily-detail window.
// That is the state where every section (gantt, presence, meals) has content.
const TODAY = localDate(new Date());
const WEDDING_DATE = shiftDays(TODAY, 4);
const DAILY_START = shiftDays(WEDDING_DATE, -7);
const PREPARATION_START = shiftDays(WEDDING_DATE, -56);

/** The eight days rendered by the final-weeks gantt: J−7 through the wedding day. */
const DEMO_DAYS: string[] = Array.from({ length: 8 }, (_, offset) => shiftDays(DAILY_START, offset));

const demoPermissions = (): Record<SectionKey, SectionPermission> =>
  Object.fromEntries(
    DEMO_SECTIONS.map(section => [section, { canView: true, canEdit: true }]),
  ) as Record<SectionKey, SectionPermission>;

const DEMO_ACCOUNT: AuthAccount = {
  id: 'demo-account',
  guestId: 'dg1',
  email: 'demo@mon-mariage.app',
  profileKey: 'organizer',
  isOrganizer: true,
  permissions: demoPermissions(),
};

const buildGuests = (): Guest[] => [
  { id: 'dg1', firstName: 'Camille', lastName: 'Rousseau', email: 'camille.rousseau@exemple.fr', organizationRole: 'other', category: 'famille-elle', rsvp: 'confirmed', hasPlusOne: false, plusOneName: '', kids: [], dietary: '', events: ['rehearsal', 'ceremony', 'dinner'], transport: 'voiture', notes: 'La mariée' },
  { id: 'dg2', firstName: 'Alexandre', lastName: 'Vasseur', email: 'alexandre.vasseur@exemple.fr', organizationRole: 'other', category: 'famille-moi', rsvp: 'confirmed', hasPlusOne: false, plusOneName: '', kids: [], dietary: '', events: ['rehearsal', 'ceremony', 'dinner'], transport: 'voiture', notes: 'Le marié' },
  { id: 'dg3', firstName: 'Hélène', lastName: 'Rousseau', email: 'helene.rousseau@exemple.fr', organizationRole: 'parent', category: 'famille-elle', rsvp: 'confirmed', hasPlusOne: true, plusOneName: 'Bernard Rousseau', kids: [], dietary: '', events: ['rehearsal', 'ceremony', 'dinner'], transport: 'voiture', notes: 'Parents de la mariée' },
  { id: 'dg4', firstName: 'Françoise', lastName: 'Vasseur', email: 'francoise.vasseur@exemple.fr', organizationRole: 'parent', category: 'famille-moi', rsvp: 'confirmed', hasPlusOne: true, plusOneName: 'Michel Vasseur', kids: [], dietary: 'Sans lactose', events: ['rehearsal', 'ceremony', 'dinner'], transport: 'voiture', notes: 'Parents du marié' },
  { id: 'dg5', firstName: 'Léa', lastName: 'Rousseau', email: 'lea.rousseau@exemple.fr', organizationRole: 'sibling', category: 'famille-elle', rsvp: 'confirmed', hasPlusOne: true, plusOneName: 'Nicolas Berger', kids: [{ id: 'dg5-k1', name: 'Jade', age: 5 }], dietary: '', events: ['rehearsal', 'ceremony', 'dinner'], transport: 'train', notes: 'Sœur de la mariée' },
  { id: 'dg6', firstName: 'Julien', lastName: 'Vasseur', email: 'julien.vasseur@exemple.fr', organizationRole: 'sibling', category: 'famille-moi', rsvp: 'confirmed', hasPlusOne: false, plusOneName: '', kids: [], dietary: '', events: ['rehearsal', 'ceremony', 'dinner'], transport: 'voiture', notes: 'Frère du marié' },
  { id: 'dg7', firstName: 'Marion', lastName: 'Delacroix', email: 'marion.delacroix@exemple.fr', organizationRole: 'witness', category: 'temoins', rsvp: 'confirmed', hasPlusOne: true, plusOneName: 'Paul Delacroix', kids: [{ id: 'dg7-k1', name: 'Anouk', age: 7 }], dietary: '', events: ['rehearsal', 'ceremony', 'dinner'], transport: 'train', notes: 'Témoin de la mariée' },
  { id: 'dg8', firstName: 'Vincent', lastName: 'Nguyen', email: 'vincent.nguyen@exemple.fr', organizationRole: 'witness', category: 'temoins', rsvp: 'confirmed', hasPlusOne: true, plusOneName: 'Sarah Nguyen', kids: [], dietary: '', events: ['rehearsal', 'ceremony', 'dinner'], transport: 'avion', notes: 'Témoin du marié · arrive de Lisbonne' },
  { id: 'dg9', firstName: 'Chloé', lastName: 'Marchand', email: 'chloe.marchand@exemple.fr', organizationRole: 'witness', category: 'temoins', rsvp: 'confirmed', hasPlusOne: false, plusOneName: '', kids: [], dietary: 'Végétarienne', events: ['rehearsal', 'ceremony', 'dinner'], transport: 'train', notes: 'Témoin · gère le discours' },
  { id: 'dg10', firstName: 'Simone', lastName: 'Rousseau', email: '', organizationRole: 'other', category: 'famille-elle', rsvp: 'confirmed', hasPlusOne: false, plusOneName: '', kids: [], dietary: 'Repas mixé', events: ['ceremony', 'dinner'], transport: 'voiture', notes: 'Grand-mère · mobilité réduite, table proche de la sortie' },
  { id: 'dg11', firstName: 'Antoine', lastName: 'Lemoine', email: 'antoine.lemoine@exemple.fr', organizationRole: 'friend_cousin', category: 'amis', rsvp: 'confirmed', hasPlusOne: true, plusOneName: 'Inès Lemoine', kids: [{ id: 'dg11-k1', name: 'Gaspard', age: 3 }, { id: 'dg11-k2', name: 'Louise', age: 6 }], dietary: '', events: ['ceremony', 'dinner'], transport: 'voiture', notes: '' },
  { id: 'dg12', firstName: 'Sofia', lastName: 'Bianchi', email: 'sofia.bianchi@exemple.fr', organizationRole: 'friend_cousin', category: 'amis', rsvp: 'confirmed', hasPlusOne: true, plusOneName: 'Matteo Bianchi', kids: [], dietary: 'Sans gluten', events: ['ceremony', 'dinner'], transport: 'avion', notes: 'Arrive de Milan' },
  { id: 'dg13', firstName: 'Karim', lastName: 'Benali', email: 'karim.benali@exemple.fr', organizationRole: 'friend_cousin', category: 'amis', rsvp: 'confirmed', hasPlusOne: false, plusOneName: '', kids: [], dietary: 'Halal', events: ['ceremony', 'dinner'], transport: 'train', notes: 'Prépare la playlist du cocktail' },
  { id: 'dg14', firstName: 'Émilie', lastName: 'Garnier', email: 'emilie.garnier@exemple.fr', organizationRole: 'friend_cousin', category: 'amis', rsvp: 'confirmed', hasPlusOne: true, plusOneName: '', kids: [], dietary: '', events: ['ceremony', 'dinner'], transport: 'voiture', notes: 'Plus-one à confirmer' },
  { id: 'dg15', firstName: 'Thomas', lastName: 'Faure', email: 'thomas.faure@exemple.fr', organizationRole: 'friend_cousin', category: 'amis', rsvp: 'pending', hasPlusOne: true, plusOneName: 'Clara Faure', kids: [{ id: 'dg15-k1', name: 'Milo', age: 8 }], dietary: '', events: ['ceremony', 'dinner'], transport: '', notes: 'Relancer avant vendredi' },
  { id: 'dg16', firstName: 'Nathalie', lastName: 'Perrin', email: 'nathalie.perrin@exemple.fr', organizationRole: 'friend_cousin', category: 'famille-elle', rsvp: 'pending', hasPlusOne: false, plusOneName: '', kids: [], dietary: '', events: ['ceremony', 'dinner'], transport: 'train', notes: 'Cousine · attend confirmation employeur' },
  { id: 'dg17', firstName: 'Grégoire', lastName: 'Aubert', email: 'gregoire.aubert@exemple.fr', organizationRole: 'friend_cousin', category: 'famille-moi', rsvp: 'pending', hasPlusOne: true, plusOneName: '', kids: [], dietary: '', events: ['dinner'], transport: '', notes: '' },
  { id: 'dg18', firstName: 'Pauline', lastName: 'Mercier', email: 'pauline.mercier@exemple.fr', organizationRole: 'friend_cousin', category: 'amis', rsvp: 'declined', hasPlusOne: false, plusOneName: '', kids: [], dietary: '', events: [], transport: '', notes: 'Enceinte, ne peut pas voyager' },
  { id: 'dg19', firstName: 'Raphaël', lastName: 'Ollivier', email: 'raphael.ollivier@exemple.fr', organizationRole: 'friend_cousin', category: 'amis', rsvp: 'declined', hasPlusOne: false, plusOneName: '', kids: [], dietary: '', events: [], transport: '', notes: 'En déplacement professionnel' },
  { id: 'dg20', firstName: 'Béatrice', lastName: 'Vasseur', email: 'beatrice.vasseur@exemple.fr', organizationRole: 'other', category: 'famille-moi', rsvp: 'confirmed', hasPlusOne: false, plusOneName: '', kids: [], dietary: '', events: ['ceremony', 'dinner'], transport: 'voiture', notes: 'Tante · s’occupe du livre d’or' },
];

const buildHouses = (): House[] => [
  { id: 'dh1', name: 'Mas des Oliviers', rooms: [
    { id: 'dr1', name: 'Suite des Mariés', bedType: 'double', beds: 1, guestIds: ['dg1', 'dg2'] },
    { id: 'dr2', name: 'Chambre Lavande', bedType: 'double', beds: 1, guestIds: ['dg3', 'dg3__plus_one'] },
    { id: 'dr3', name: 'Chambre Romarin', bedType: 'double', beds: 1, guestIds: ['dg4', 'dg4__plus_one'] },
    { id: 'dr4', name: 'Chambre Thym', bedType: 'single', beds: 2, guestIds: ['dg10'] },
  ]},
  { id: 'dh2', name: 'Gîte du Vieux Puits', rooms: [
    { id: 'dr5', name: 'Chambre Sud', bedType: 'double', beds: 1, guestIds: ['dg5', 'dg5__plus_one'] },
    { id: 'dr6', name: 'Chambre Nord', bedType: 'double', beds: 1, guestIds: ['dg7', 'dg7__plus_one'] },
    { id: 'dr7', name: 'Dortoir des Enfants', bedType: 'single', beds: 4, guestIds: ['dg5-k1', 'dg7-k1'] },
    { id: 'dr8', name: 'Mezzanine', bedType: 'single', beds: 2, guestIds: ['dg9'] },
  ]},
  { id: 'dh3', name: 'Bergerie', rooms: [
    { id: 'dr9', name: 'Grande Chambre', bedType: 'double', beds: 2, guestIds: ['dg8', 'dg8__plus_one', 'dg12'] },
    { id: 'dr10', name: 'Chambre Atelier', bedType: 'double', beds: 1, guestIds: ['dg6'] },
    { id: 'dr11', name: 'Chambre Cour', bedType: 'single', beds: 2, guestIds: ['dg13'] },
  ]},
  { id: 'dh4', name: 'Camping du Domaine', rooms: [
    { id: 'dr12', name: 'Tente Lodge 1', bedType: 'double', beds: 2, guestIds: ['dg11', 'dg11__plus_one'] },
    { id: 'dr13', name: 'Tente Lodge 2', bedType: 'double', beds: 2, guestIds: [] },
  ]},
];

const buildTables = (): Table[] => [
  { id: 'dt1', name: 'Table d’honneur', seats: 8, shape: 'rect', x: 700, y: 170, rotation: 0, assignments: [
    { guestId: 'dg1', seat: 0 }, { guestId: 'dg2', seat: 1 }, { guestId: 'dg7', seat: 2 },
    { guestId: 'dg8', seat: 3 }, { guestId: 'dg9', seat: 4 },
  ]},
  { id: 'dt2', name: 'Famille Rousseau', seats: 10, shape: 'round', x: 330, y: 430, rotation: 0, assignments: [
    { guestId: 'dg3', seat: 0 }, { guestId: 'dg3__plus_one', seat: 1 }, { guestId: 'dg5', seat: 2 },
    { guestId: 'dg5__plus_one', seat: 3 }, { guestId: 'dg10', seat: 4 }, { guestId: 'dg16', seat: 5 },
  ]},
  { id: 'dt3', name: 'Famille Vasseur', seats: 10, shape: 'round', x: 1070, y: 430, rotation: 0, assignments: [
    { guestId: 'dg4', seat: 0 }, { guestId: 'dg4__plus_one', seat: 1 }, { guestId: 'dg6', seat: 2 },
    { guestId: 'dg20', seat: 3 }, { guestId: 'dg17', seat: 4 },
  ]},
  { id: 'dt4', name: 'Amis de fac', seats: 10, shape: 'round', x: 330, y: 720, rotation: 0, assignments: [
    { guestId: 'dg11', seat: 0 }, { guestId: 'dg11__plus_one', seat: 1 }, { guestId: 'dg13', seat: 2 },
    { guestId: 'dg14', seat: 3 }, { guestId: 'dg14__plus_one', seat: 4 },
  ]},
  { id: 'dt5', name: 'Amis d’enfance', seats: 10, shape: 'round', x: 700, y: 760, rotation: 0, assignments: [
    { guestId: 'dg12', seat: 0 }, { guestId: 'dg12__plus_one', seat: 1 }, { guestId: 'dg7__plus_one', seat: 2 },
    { guestId: 'dg8__plus_one', seat: 3 },
  ]},
  { id: 'dt6', name: 'Table des enfants', seats: 8, shape: 'rect', x: 1070, y: 720, rotation: 0, assignments: [
    { guestId: 'dg5-k1', seat: 0 }, { guestId: 'dg7-k1', seat: 1 },
    { guestId: 'dg11-k1', seat: 2 }, { guestId: 'dg11-k2', seat: 3 },
  ]},
];

const buildBudget = (): Budget => ({
  categories: [
    { id: 'dbc1', name: 'Lieu & réception', estimated: 12000, items: [
      { id: 'dbi1', label: 'Acompte domaine', amount: 4000, date: shiftDays(WEDDING_DATE, -180) },
      { id: 'dbi2', label: 'Deuxième versement', amount: 4000, date: shiftDays(WEDDING_DATE, -60) },
    ]},
    { id: 'dbc2', name: 'Traiteur', estimated: 16500, items: [
      { id: 'dbi3', label: 'Acompte traiteur', amount: 5000, date: shiftDays(WEDDING_DATE, -150) },
      { id: 'dbi4', label: 'Ajustement convives (+8)', amount: 760, date: shiftDays(WEDDING_DATE, -21) },
    ]},
    { id: 'dbc3', name: 'Photographie & vidéo', estimated: 4200, items: [
      { id: 'dbi5', label: 'Acompte photographe', amount: 1200, date: shiftDays(WEDDING_DATE, -120) },
      { id: 'dbi6', label: 'Option drone', amount: 350, date: shiftDays(WEDDING_DATE, -30) },
    ]},
    { id: 'dbc4', name: 'Musique & DJ', estimated: 2400, items: [
      { id: 'dbi7', label: 'Acompte DJ', amount: 700, date: shiftDays(WEDDING_DATE, -95) },
    ]},
    { id: 'dbc5', name: 'Fleurs & décoration', estimated: 3200, items: [
      { id: 'dbi8', label: 'Composition florale', amount: 1800, date: shiftDays(WEDDING_DATE, -14) },
      { id: 'dbi9', label: 'Location bougeoirs', amount: 240, date: shiftDays(WEDDING_DATE, -12) },
    ]},
    { id: 'dbc6', name: 'Tenues', estimated: 4500, items: [
      { id: 'dbi10', label: 'Robe + retouches', amount: 2600, date: shiftDays(WEDDING_DATE, -75) },
      { id: 'dbi11', label: 'Costume', amount: 1150, date: shiftDays(WEDDING_DATE, -50) },
    ]},
    { id: 'dbc7', name: 'Papeterie', estimated: 900, items: [
      { id: 'dbi12', label: 'Faire-part', amount: 620, date: shiftDays(WEDDING_DATE, -160) },
      { id: 'dbi13', label: 'Plan de table imprimé', amount: 95, date: shiftDays(WEDDING_DATE, -10) },
    ]},
    { id: 'dbc8', name: 'Coiffure & maquillage', estimated: 850, items: [
      { id: 'dbi14', label: 'Essai coiffure', amount: 120, date: shiftDays(WEDDING_DATE, -40) },
    ]},
    { id: 'dbc9', name: 'Transport', estimated: 1500, items: [
      { id: 'dbi15', label: 'Navette invités', amount: 900, date: shiftDays(WEDDING_DATE, -18) },
    ]},
    { id: 'dbc10', name: 'Imprévus', estimated: 2000, items: [] },
  ],
});

const buildTodos = (): TodoGroup[] => [
  { id: 'dtg1', title: 'Traiteur & boissons', tasks: [
    { id: 'dtk1', label: 'Valider le menu définitif', done: true, assignee: 'elle', dueDate: shiftDays(WEDDING_DATE, -45) },
    { id: 'dtk2', label: 'Communiquer le nombre final de convives', done: true, assignee: 'marie', dueDate: shiftDays(WEDDING_DATE, -21) },
    { id: 'dtk3', label: 'Confirmer les régimes spéciaux', done: false, assignee: 'elle', dueDate: shiftDays(WEDDING_DATE, -3) },
    { id: 'dtk4', label: 'Récupérer le vin chez le caviste', done: false, assignee: 'famille', dueDate: shiftDays(WEDDING_DATE, -2) },
  ]},
  { id: 'dtg2', title: 'Photo & vidéo', tasks: [
    { id: 'dtk5', label: 'Signer le contrat photographe', done: true, assignee: 'marie', dueDate: shiftDays(WEDDING_DATE, -120) },
    { id: 'dtk6', label: 'Envoyer la liste des photos de groupe', done: true, assignee: 'elle', dueDate: shiftDays(WEDDING_DATE, -14) },
    { id: 'dtk7', label: 'Caler le planning du jour J avec le vidéaste', done: false, assignee: 'marie', dueDate: shiftDays(WEDDING_DATE, -2) },
  ]},
  { id: 'dtg3', title: 'Décoration', tasks: [
    { id: 'dtk8', label: 'Commander les fleurs séchées', done: true, assignee: 'elle', dueDate: shiftDays(WEDDING_DATE, -35) },
    { id: 'dtk9', label: 'Monter les centres de table', done: false, assignee: 'famille', dueDate: shiftDays(WEDDING_DATE, -1) },
    { id: 'dtk10', label: 'Installer la guirlande guinguette', done: false, assignee: 'prestataire', dueDate: shiftDays(WEDDING_DATE, -1) },
    { id: 'dtk11', label: 'Préparer le panneau de bienvenue', done: false, assignee: 'elle', dueDate: shiftDays(WEDDING_DATE, -2) },
  ]},
  { id: 'dtg4', title: 'Invités & logistique', tasks: [
    { id: 'dtk12', label: 'Envoyer les faire-part', done: true, assignee: 'marie', dueDate: shiftDays(WEDDING_DATE, -160) },
    { id: 'dtk13', label: 'Relancer les RSVP en attente', done: false, assignee: 'marie', dueDate: shiftDays(WEDDING_DATE, -5) },
    { id: 'dtk14', label: 'Confirmer la navette de 23h', done: false, assignee: 'famille', dueDate: shiftDays(WEDDING_DATE, -3) },
    { id: 'dtk15', label: 'Imprimer le plan de table', done: false, assignee: 'elle', dueDate: shiftDays(WEDDING_DATE, -2) },
  ]},
  { id: 'dtg5', title: 'Cérémonie', tasks: [
    { id: 'dtk16', label: 'Écrire les vœux', done: false, assignee: 'marie', dueDate: shiftDays(WEDDING_DATE, -2) },
    { id: 'dtk17', label: 'Répétition avec l’officiante', done: false, assignee: 'elle', dueDate: shiftDays(WEDDING_DATE, -1) },
    { id: 'dtk18', label: 'Préparer les alliances', done: true, assignee: 'marie', dueDate: shiftDays(WEDDING_DATE, -30) },
  ]},
];

const vendorDetails = (category: VendorCategoryKey, overrides: VendorDetails): VendorDetails =>
  ({ ...defaultDetailsFor(category), ...overrides });

const buildVendors = (): Vendor[] => [
  {
    id: 'dv1', category: 'traiteur', name: 'Table & Terroir', contactName: 'Sébastien Roux',
    phone: '04 90 12 34 56', email: 'contact@tableetterroir.fr', website: 'https://tableetterroir.fr',
    instagram: '@tableetterroir', address: '12 route des Vignes, 84210 Pernes-les-Fontaines',
    priceEstimate: 16000, priceFinal: 16760, depositAmount: 5000, depositPaid: true,
    balanceDueDate: shiftDays(WEDDING_DATE, -2), status: 'acompte-paye',
    meetingDate: shiftDays(WEDDING_DATE, -150), contractSigned: true, contractUrl: '', rating: 5,
    notes: 'Dégustation excellente. Prévoit 2 serveurs supplémentaires offerts.',
    details: vendorDetails('traiteur', {
      cuisineStyle: 'Bistronomie provençale', pricePerGuest: 95, minGuests: 40, maxGuests: 120,
      tastingDate: shiftDays(WEDDING_DATE, -90), cocktailIncluded: true, brunchIncluded: true,
      weddingCakeIncluded: false, childMenu: true, vegetarianOption: true,
      dietaryAccommodations: 'Sans gluten, halal, repas mixé', serviceStaffIncluded: true,
      serviceStaffCount: 8, beveragePackage: 'Forfait vins + softs', corkageFee: 0,
    }),
  },
  {
    id: 'dv2', category: 'photographe', name: 'Studio Lumière Douce', contactName: 'Anaïs Mercier',
    phone: '06 22 45 78 90', email: 'anais@lumieredouce.photo', website: 'https://lumieredouce.photo',
    instagram: '@lumieredouce', address: 'Avignon',
    priceEstimate: 2800, priceFinal: 2800, depositAmount: 1200, depositPaid: true,
    balanceDueDate: shiftDays(WEDDING_DATE, 7), status: 'acompte-paye',
    meetingDate: shiftDays(WEDDING_DATE, -120), contractSigned: true, contractUrl: '', rating: 5,
    notes: 'Séance engagement faite en avril. Galerie livrée sous 6 semaines.',
    details: vendorDetails('photographe', {
      style: 'Reportage naturel', hoursCovered: 12, photographerCount: 2, preWeddingShoot: true,
      editedPhotosCount: 600, rawPhotosIncluded: false,
    }),
  },
  {
    id: 'dv3', category: 'videaste', name: 'Atelier 24 Images', contactName: 'Yanis Cordier',
    phone: '06 78 11 22 33', email: 'yanis@atelier24images.fr', website: 'https://atelier24images.fr',
    instagram: '@atelier24images', address: 'Marseille',
    priceEstimate: 1400, priceFinal: 1750, depositAmount: 500, depositPaid: true,
    balanceDueDate: shiftDays(WEDDING_DATE, 14), status: 'acompte-paye',
    meetingDate: shiftDays(WEDDING_DATE, -70), contractSigned: true, contractUrl: '', rating: 4,
    notes: 'Option drone ajoutée (+350 €). Film de 8 min + teaser.',
    details: vendorDetails('videaste', {}),
  },
  {
    id: 'dv4', category: 'dj', name: 'DJ Malo', contactName: 'Malo Grandjean',
    phone: '06 55 66 77 88', email: 'booking@djmalo.fr', website: 'https://djmalo.fr',
    instagram: '@djmalo', address: 'Nîmes',
    priceEstimate: 2400, priceFinal: 2400, depositAmount: 700, depositPaid: true,
    balanceDueDate: shiftDays(WEDDING_DATE, -1), status: 'acompte-paye',
    meetingDate: shiftDays(WEDDING_DATE, -95), contractSigned: true, contractUrl: '', rating: 4,
    notes: 'Playlist partagée à compléter. Fin à 3 h, sono fournie.',
    details: vendorDetails('dj', {}),
  },
  {
    id: 'dv5', category: 'fleuriste', name: 'Fleurs & Fabrique', contactName: 'Camille Duthilleul',
    phone: '04 90 55 44 33', email: 'bonjour@fleursetfabrique.fr', website: '',
    instagram: '@fleursetfabrique', address: 'L’Isle-sur-la-Sorgue',
    priceEstimate: 3000, priceFinal: 3040, depositAmount: 1800, depositPaid: true,
    balanceDueDate: shiftDays(WEDDING_DATE, -1), status: 'acompte-paye',
    meetingDate: shiftDays(WEDDING_DATE, -35), contractSigned: true, contractUrl: '', rating: 5,
    notes: 'Livraison la veille à 16 h. Arche + 10 centres de table + bouquet.',
    details: vendorDetails('fleuriste', {}),
  },
  {
    id: 'dv6', category: 'coiffure-maquillage', name: 'Belle Journée', contactName: 'Inès Charpentier',
    phone: '06 41 52 63 74', email: 'ines@bellejournee.fr', website: '',
    instagram: '@bellejournee.mariage', address: 'Cavaillon',
    priceEstimate: 850, priceFinal: 850, depositAmount: 0, depositPaid: false,
    balanceDueDate: WEDDING_DATE, status: 'reserve',
    meetingDate: shiftDays(WEDDING_DATE, -40), contractSigned: true, contractUrl: '', rating: 4,
    notes: 'Arrivée sur place à 8 h. Essai validé, chignon bas.',
    details: vendorDetails('coiffure-maquillage', {}),
  },
  {
    id: 'dv7', category: 'officiant', name: 'Les Mots Justes', contactName: 'Hélène Vidal',
    phone: '06 12 98 76 54', email: 'helene@lesmotsjustes.fr', website: 'https://lesmotsjustes.fr',
    instagram: '', address: 'Aix-en-Provence',
    priceEstimate: 900, priceFinal: 900, depositAmount: 300, depositPaid: true,
    balanceDueDate: shiftDays(WEDDING_DATE, -1), status: 'acompte-paye',
    meetingDate: shiftDays(WEDDING_DATE, -60), contractSigned: true, contractUrl: '', rating: 5,
    notes: 'Cérémonie laïque, 3 interventions de proches. Répétition prévue la veille.',
    details: vendorDetails('officiant', {}),
  },
  {
    id: 'dv8', category: 'location-vaisselle', name: 'Options Réception', contactName: 'Service commercial',
    phone: '04 90 88 77 66', email: 'devis@optionsreception.fr', website: 'https://optionsreception.fr',
    instagram: '', address: 'Avignon',
    priceEstimate: 1250, priceFinal: 0, depositAmount: 0, depositPaid: false,
    balanceDueDate: '', status: 'devis-recu',
    meetingDate: '', contractSigned: false, contractUrl: '', rating: 3,
    notes: 'Devis reçu pour 96 couverts. Comparer avec le tarif du traiteur.',
    details: vendorDetails('location-vaisselle', {}),
  },
  {
    id: 'dv9', category: 'voiture', name: 'Rétro Drive Provence', contactName: 'Gilbert Assante',
    phone: '06 33 22 11 00', email: 'contact@retrodrive.fr', website: '',
    instagram: '@retrodriveprovence', address: 'Carpentras',
    priceEstimate: 600, priceFinal: 0, depositAmount: 0, depositPaid: false,
    balanceDueDate: '', status: 'devis-demande',
    meetingDate: '', contractSigned: false, contractUrl: '', rating: 0,
    notes: 'Citroën DS 1969. En attente de confirmation de disponibilité.',
    details: vendorDetails('voiture', {}),
  },
];

const buildPresences = (): Record<string, DemoPresence> => {
  const mealsFor = (dates: string[], kinds: MealKind[]): Record<string, MealKind[]> =>
    Object.fromEntries(dates.map(date => [date, [...kinds]]));
  const allKinds: MealKind[] = ['breakfast', 'lunch', 'dinner'];
  const [j7, j6, j5, j4, j3, j2, j1, jourJ] = DEMO_DAYS;

  return {
    dg1: { arrivalAt: at(j7, '10:00'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor(DEMO_DAYS, allKinds) },
    dg2: { arrivalAt: at(j7, '10:00'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor(DEMO_DAYS, allKinds) },
    dg3: { arrivalAt: at(j5, '16:00'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j5, j4, j3, j2, j1, jourJ], allKinds) },
    dg3__plus_one: { arrivalAt: at(j5, '16:00'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j5, j4, j3, j2, j1, jourJ], allKinds) },
    dg4: { arrivalAt: at(j4, '11:30'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j4, j3, j2, j1, jourJ], allKinds) },
    dg4__plus_one: { arrivalAt: at(j4, '11:30'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j4, j3, j2, j1, jourJ], allKinds) },
    dg5: { arrivalAt: at(j3, '18:45'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j2, j1, jourJ], allKinds) },
    dg5__plus_one: { arrivalAt: at(j3, '18:45'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j2, j1, jourJ], allKinds) },
    'dg5-k1': { arrivalAt: at(j3, '18:45'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j2, j1, jourJ], allKinds) },
    dg6: { arrivalAt: at(j6, '09:00'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j6, j5, j4, j3, j2, j1, jourJ], allKinds) },
    dg7: { arrivalAt: at(j2, '14:00'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j2, j1, jourJ], allKinds) },
    dg7__plus_one: { arrivalAt: at(j2, '14:00'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j2, j1, jourJ], allKinds) },
    'dg7-k1': { arrivalAt: at(j2, '14:00'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j2, j1, jourJ], allKinds) },
    dg8: { arrivalAt: at(j1, '19:20'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([jourJ], allKinds) },
    dg8__plus_one: { arrivalAt: at(j1, '19:20'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([jourJ], allKinds) },
    dg9: { arrivalAt: at(j3, '12:00'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j3, j2, j1, jourJ], allKinds) },
    dg10: { arrivalAt: at(j1, '15:00'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j1, jourJ], ['lunch', 'dinner']) },
    dg13: { arrivalAt: at(j2, '17:00'), departureAt: at(jourJ, '23:59'), mealSelections: mealsFor([j1, jourJ], allKinds) },
  };
};

const buildMeals = (): FinalWeeksMeal[] => {
  const [j7, j6, j5, j4, j3, j2, j1, jourJ] = DEMO_DAYS;
  const meal = (date: string, kind: MealKind, menu: string, notes: string, cookIds: string[]): FinalWeeksMeal =>
    ({ date, kind, menu, notes, cookIds, headcount: 0 });

  return [
    meal(j7, 'dinner', 'Pâtes au pesto', 'Repas d’arrivée, simple.', ['demo-account']),
    meal(j6, 'lunch', 'Salade composée', '', ['demo-account']),
    meal(j6, 'dinner', 'Ratatouille + riz', '', ['dacc-julien']),
    meal(j5, 'dinner', 'Barbecue', 'Sortir la viande du congélateur la veille.', ['dacc-julien', 'dacc-helene']),
    meal(j4, 'lunch', 'Quiches et crudités', '', ['dacc-helene']),
    meal(j4, 'dinner', 'Curry de légumes', 'Version sans gluten à part pour Sofia.', ['dacc-chloe']),
    meal(j3, 'breakfast', 'Viennoiseries', 'Commande à la boulangerie du village.', ['dacc-helene']),
    meal(j3, 'lunch', 'Sandwichs sur le pouce', 'Journée montage de la tente.', []),
    meal(j3, 'dinner', 'Paëlla géante', 'Traiteur local, livrée à 19 h.', ['demo-account']),
    meal(j2, 'breakfast', 'Petit-déjeuner buffet', '', ['dacc-helene']),
    meal(j2, 'lunch', 'Tartes salées', '', ['dacc-chloe']),
    meal(j2, 'dinner', 'Grillades + salades', 'Arrivée des témoins.', ['dacc-julien']),
    meal(j1, 'breakfast', 'Petit-déjeuner buffet', '', ['dacc-helene']),
    meal(j1, 'lunch', 'Buffet froid', 'Jour de montage, service en continu.', []),
    meal(j1, 'dinner', 'Dîner de répétition', 'Traiteur · 42 couverts sous la tente.', ['demo-account']),
    meal(jourJ, 'breakfast', 'Brunch des mariés', 'Servi en chambre à 9 h.', ['dacc-francoise']),
    meal(jourJ, 'lunch', 'Plateaux repas', 'Pour l’équipe de préparation et les prestataires.', ['dacc-francoise']),
    meal(jourJ, 'dinner', 'Dîner de mariage', 'Traiteur Table & Terroir · 96 couverts.', []),
  ];
};

const buildFinalTasks = (): FinalWeeksTask[] => {
  const [j7, j6, j5, j4, j3, j2, j1, jourJ] = DEMO_DAYS;
  let sequence = 0;
  const task = (
    date: string, start: string, end: string, title: string,
    category: FinalWeeksTask['category'], status: FinalWeeksTask['status'],
    assigneeIds: string[], notes = '',
  ): FinalWeeksTask => ({
    id: `dft${sequence += 1}`,
    title,
    notes,
    category,
    scheduledAt: at(date, start),
    endsAt: at(date, end),
    status,
    recurrenceGroupId: null,
    assigneeIds,
  });

  return [
    task(j7, '09:00', '12:00', 'État des lieux du domaine', 'wedding', 'done', ['demo-account'], 'Relevé des compteurs et remise des clés.'),
    task(j7, '14:00', '17:00', 'Grandes courses hebdomadaires', 'groceries', 'done', ['demo-account', 'dacc-julien'], 'Metro + supermarché du village.'),
    task(j6, '09:30', '11:00', 'Réception de la vaisselle louée', 'errands', 'done', ['dacc-julien']),
    task(j6, '14:00', '18:00', 'Nettoyage de la grange', 'cleaning', 'done', ['dacc-julien', 'dacc-helene']),
    task(j5, '08:30', '10:00', 'Récupérer la remorque', 'errands', 'done', ['dacc-julien']),
    task(j5, '10:30', '16:00', 'Montage de la tente de réception', 'wedding', 'done', ['demo-account', 'dacc-julien'], 'Prestataire présent, 4 personnes nécessaires.'),
    task(j5, '17:00', '18:30', 'Courses fraîches', 'groceries', 'done', ['dacc-helene']),
    task(j4, '09:00', '12:00', 'Installation des tables et chaises', 'wedding', 'done', ['demo-account', 'dacc-julien', 'dacc-chloe']),
    task(j4, '14:00', '16:00', 'Test du système son', 'wedding', 'done', ['dacc-karim'], 'Vérifier la prise extérieure côté grange.'),
    task(j4, '16:30', '18:00', 'Repassage des nappes', 'cleaning', 'done', ['dacc-francoise']),
    task(j3, '08:00', '09:30', 'Aller chercher les viennoiseries', 'errands', 'done', ['dacc-helene']),
    task(j3, '09:30', '13:00', 'Décoration de la grange', 'wedding', 'in_progress', ['dacc-chloe', 'dacc-francoise'], 'Guirlandes, tentures, panneaux directionnels.'),
    task(j3, '14:00', '17:00', 'Montage des centres de table', 'wedding', 'in_progress', ['dacc-chloe'], 'Fleurs séchées + bougeoirs loués.'),
    task(j3, '15:00', '16:00', 'Récupérer le vin chez le caviste', 'errands', 'todo', [], 'Personne assignée — 6 cartons à charger.'),
    task(j3, '18:00', '19:30', 'Préparation du dîner', 'cooking', 'todo', ['demo-account']),
    task(j2, '09:00', '10:30', 'Courses de dernière minute', 'groceries', 'todo', ['dacc-helene']),
    task(j2, '10:00', '12:00', 'Répétition de la cérémonie', 'wedding', 'todo', ['demo-account', 'dacc-chloe'], 'Avec l’officiante et les intervenants.'),
    task(j2, '14:00', '16:00', 'Accueil des témoins', 'wedding', 'todo', ['dacc-francoise']),
    task(j2, '16:00', '18:00', 'Installation du coin bar', 'wedding', 'todo', ['dacc-karim']),
    task(j1, '08:30', '10:00', 'Livraison des fleurs', 'wedding', 'todo', ['dacc-chloe'], 'Fleurs & Fabrique · arche + bouquets.'),
    task(j1, '10:00', '13:00', 'Dressage des tables', 'wedding', 'todo', ['dacc-francoise', 'dacc-helene']),
    task(j1, '14:00', '15:30', 'Briefing prestataires', 'wedding', 'todo', ['demo-account']),
    task(j1, '16:00', '17:00', 'Installation du plan de table', 'wedding', 'todo', []),
    task(j1, '19:00', '22:00', 'Dîner de répétition', 'wedding', 'todo', ['demo-account']),
    task(jourJ, '08:00', '09:00', 'Petit-déjeuner des mariés', 'cooking', 'todo', ['dacc-francoise']),
    task(jourJ, '09:00', '12:00', 'Coiffure et maquillage', 'wedding', 'todo', ['demo-account'], 'Prestataire sur place à 8 h.'),
    task(jourJ, '12:00', '13:00', 'Derniers réglages salle', 'wedding', 'todo', ['dacc-julien', 'dacc-karim']),
    task(jourJ, '14:30', '15:30', 'Arrivée des invités', 'wedding', 'todo', ['dacc-francoise']),
    task(jourJ, '15:30', '16:30', 'Cérémonie laïque', 'wedding', 'todo', ['demo-account']),
    task(jourJ, '16:30', '19:00', 'Cocktail et photos de groupe', 'wedding', 'todo', ['dacc-chloe']),
    task(jourJ, '19:30', '23:00', 'Dîner', 'wedding', 'todo', []),
    task(jourJ, '23:00', '23:59', 'Ouverture du bal', 'wedding', 'todo', ['dacc-karim']),
  ];
};

const invitationFields = (
  status: AdminAccount['status'],
): Pick<AdminAccount, 'hasPassword' | 'invitationSentAt' | 'invitationExpiresAt'> => {
  if (status === 'pending') {
    return {
      hasPassword: false,
      invitationSentAt: at(shiftDays(TODAY, -1), '09:00'),
      invitationExpiresAt: at(shiftDays(TODAY, 1), '09:00'),
    };
  }
  return {
    hasPassword: true,
    invitationSentAt: at(shiftDays(TODAY, -14), '11:00'),
    invitationExpiresAt: null,
  };
};

const account = (
  fields: Omit<AdminAccount, 'hasPassword' | 'invitationSentAt' | 'invitationExpiresAt'>,
): AdminAccount => ({
  ...fields,
  ...invitationFields(fields.status),
});

const buildAccounts = (): AdminAccount[] => [
  account({ id: 'demo-account', guestId: 'dg1', email: 'demo@mon-mariage.app', status: 'active', profileKey: 'organizer', isOrganizer: true, lastLoginAt: at(TODAY, '08:12'), name: 'Camille Rousseau' }),
  account({ id: 'dacc-alexandre', guestId: 'dg2', email: 'alexandre.vasseur@exemple.fr', status: 'active', profileKey: 'organizer', isOrganizer: true, lastLoginAt: at(shiftDays(TODAY, -1), '21:40'), name: 'Alexandre Vasseur' }),
  account({ id: 'dacc-helene', guestId: 'dg3', email: 'helene.rousseau@exemple.fr', status: 'active', profileKey: 'parent', isOrganizer: false, lastLoginAt: at(shiftDays(TODAY, -2), '18:05'), name: 'Hélène Rousseau' }),
  account({ id: 'dacc-francoise', guestId: 'dg4', email: 'francoise.vasseur@exemple.fr', status: 'active', profileKey: 'parent', isOrganizer: false, lastLoginAt: at(shiftDays(TODAY, -3), '09:22'), name: 'Françoise Vasseur' }),
  account({ id: 'dacc-julien', guestId: 'dg6', email: 'julien.vasseur@exemple.fr', status: 'active', profileKey: 'sibling', isOrganizer: false, lastLoginAt: at(shiftDays(TODAY, -1), '12:30'), name: 'Julien Vasseur' }),
  account({ id: 'dacc-chloe', guestId: 'dg9', email: 'chloe.marchand@exemple.fr', status: 'active', profileKey: 'witness', isOrganizer: false, lastLoginAt: at(shiftDays(TODAY, -4), '20:15'), name: 'Chloé Marchand' }),
  account({ id: 'dacc-karim', guestId: 'dg13', email: 'karim.benali@exemple.fr', status: 'active', profileKey: 'friend_cousin', isOrganizer: false, lastLoginAt: null, name: 'Karim Benali' }),
  account({ id: 'dacc-marion', guestId: 'dg7', email: 'marion.delacroix@exemple.fr', status: 'pending', profileKey: 'witness', isOrganizer: false, lastLoginAt: null, name: 'Marion Delacroix' }),
];

const profilePermissions = (
  grants: Partial<Record<SectionKey, [boolean, boolean]>>,
): AdminProfile['permissions'] =>
  DEMO_SECTIONS.map(section => {
    const [canView, canEdit] = grants[section] ?? [false, false];
    return { id: `dperm-${section}`, section, canView, canEdit };
  });

const buildProfiles = (): AdminProfile[] => [
  { key: 'organizer', name: 'Organisateur', permissions: profilePermissions(Object.fromEntries(DEMO_SECTIONS.map(section => [section, [true, true]]))) },
  { key: 'parent', name: 'Parent', permissions: profilePermissions({ dashboard: [true, false], guests: [true, false], housing: [true, true], seating: [true, false], todos: [true, true], final_weeks: [true, true] }) },
  { key: 'sibling', name: 'Fratrie', permissions: profilePermissions({ dashboard: [true, false], guests: [true, false], housing: [true, false], todos: [true, true], final_weeks: [true, true] }) },
  { key: 'witness', name: 'Témoin', permissions: profilePermissions({ dashboard: [true, false], guests: [true, false], todos: [true, true], final_weeks: [true, true] }) },
  { key: 'friend_cousin', name: 'Ami / Cousin', permissions: profilePermissions({ final_weeks: [true, true] }) },
  { key: 'other', name: 'Autre', permissions: profilePermissions({ final_weeks: [true, false] }) },
];

/** Builds a fresh, self-consistent demo dataset. Every activation starts from this. */
export const createDemoDataset = (): DemoDataset => ({
  account: structuredClone(DEMO_ACCOUNT),
  eventConfig: {
    weddingDate: WEDDING_DATE,
    weddingPlace: 'Domaine de Valmont',
    preparationStart: PREPARATION_START,
    dailyStart: DAILY_START,
    timeZone: 'Europe/Paris',
  },
  guests: buildGuests(),
  houses: buildHouses(),
  tables: buildTables(),
  budget: buildBudget(),
  todos: buildTodos(),
  vendors: buildVendors(),
  presences: buildPresences(),
  meals: buildMeals(),
  finalTasks: buildFinalTasks(),
  accounts: buildAccounts(),
  profiles: buildProfiles(),
});
