import { Assignee, Budget, Guest, House, Table, TodoGroup } from './types';

export const gid = (): string => Math.random().toString(36).slice(2, 9);

export const INITIAL_GUESTS: Guest[] = [
  { id: 'g1', firstName: 'Jean-Pierre', lastName: 'Martin', email: '', organizationRole: 'parent', category: 'famille-moi', rsvp: 'confirmed', hasPlusOne: false, plusOneName: '', kids: [{ id: 'g1-k1', name: 'Zoé', age: 9 }, { id: 'g1-k2', name: 'Tom', age: 6 }], dietary: '', events: ['ceremony', 'dinner'], transport: 'voiture', notes: '' },
  { id: 'g2', firstName: 'Catherine', lastName: 'Martin', email: '', organizationRole: 'parent', category: 'famille-moi', rsvp: 'confirmed', hasPlusOne: false, plusOneName: '', kids: [], dietary: 'Végétarienne', events: ['ceremony', 'dinner'], transport: 'voiture', notes: 'Marraine du marié' },
  { id: 'g3', firstName: 'Sophie', lastName: 'Lefebvre', email: '', organizationRole: 'witness', category: 'temoins', rsvp: 'confirmed', hasPlusOne: true, plusOneName: 'Marc Lefebvre', kids: [], dietary: '', events: ['rehearsal', 'ceremony', 'dinner'], transport: 'train', notes: 'Témoin principale' },
  { id: 'g4', firstName: 'Hugo', lastName: 'Bernard', email: '', organizationRole: 'friend_cousin', category: 'amis', rsvp: 'confirmed', hasPlusOne: true, plusOneName: 'Lucie Bernard', kids: [{ id: 'g4-k1', name: 'Noé', age: 4 }], dietary: '', events: ['ceremony', 'dinner'], transport: 'voiture', notes: '' },
  { id: 'g5', firstName: 'Isabelle', lastName: 'Rousseau', email: '', organizationRole: 'sibling', category: 'famille-elle', rsvp: 'pending', hasPlusOne: false, plusOneName: '', kids: [], dietary: 'Sans gluten', events: ['ceremony', 'dinner'], transport: '', notes: '' },
  { id: 'g6', firstName: 'Thomas', lastName: 'Petit', email: '', organizationRole: 'friend_cousin', category: 'amis', rsvp: 'pending', hasPlusOne: true, plusOneName: '', kids: [], dietary: '', events: ['dinner'], transport: 'voiture', notes: '' },
  { id: 'g7', firstName: 'Marguerite', lastName: 'Dubois', email: '', organizationRole: 'other', category: 'famille-elle', rsvp: 'confirmed', hasPlusOne: false, plusOneName: '', kids: [], dietary: '', events: ['ceremony', 'dinner'], transport: 'avion', notes: 'Grand-mère' },
  { id: 'g8', firstName: 'Antoine', lastName: 'Moreau', email: '', organizationRole: 'witness', category: 'temoins', rsvp: 'confirmed', hasPlusOne: false, plusOneName: '', kids: [], dietary: '', events: ['rehearsal', 'ceremony', 'dinner'], transport: 'voiture', notes: 'Témoin du marié' },
  { id: 'g9', firstName: 'Claire', lastName: 'Simon', email: '', organizationRole: 'friend_cousin', category: 'amis', rsvp: 'declined', hasPlusOne: false, plusOneName: '', kids: [], dietary: '', events: [], transport: '', notes: 'Ne peut pas venir' },
  { id: 'g10', firstName: 'Pierre', lastName: 'Laurent', email: '', organizationRole: 'sibling', category: 'famille-moi', rsvp: 'confirmed', hasPlusOne: true, plusOneName: 'Anne Laurent', kids: [{ id: 'g10-k1', name: 'Emma', age: 12 }], dietary: '', events: ['ceremony', 'dinner'], transport: 'voiture', notes: '' },
  { id: 'g11', firstName: 'Élise', lastName: 'Fontaine', email: '', organizationRole: 'friend_cousin', category: 'amis', rsvp: 'confirmed', hasPlusOne: false, plusOneName: '', kids: [], dietary: '', events: ['ceremony', 'dinner'], transport: 'train', notes: '' },
  { id: 'g12', firstName: 'Raphaël', lastName: 'Girard', email: '', organizationRole: 'other', category: 'famille-elle', rsvp: 'pending', hasPlusOne: true, plusOneName: 'Nina Girard', kids: [{ id: 'g12-k1', name: 'Lola', age: 7 }], dietary: '', events: ['ceremony', 'dinner'], transport: 'voiture', notes: '' },
];

export const INITIAL_HOUSES: House[] = [
  { id: 'h1', name: 'Mas Principal', rooms: [
    { id: 'r1', name: 'Chambre des Maîtres', bedType: 'double', beds: 1, guestIds: ['g2', 'g1'] },
    { id: 'r2', name: 'Chambre Bleue', bedType: 'single', beds: 2, guestIds: ['g3'] },
    { id: 'r3', name: 'Chambre Jardin', bedType: 'double', beds: 1, guestIds: [] },
  ]},
  { id: 'h2', name: 'Gîte des Lavandes', rooms: [
    { id: 'r4', name: 'Studio', bedType: 'double', beds: 1, guestIds: ['g7'] },
    { id: 'r5', name: 'Chambre 1', bedType: 'single', beds: 2, guestIds: ['g8'] },
    { id: 'r6', name: 'Chambre 2', bedType: 'double', beds: 1, guestIds: [] },
  ]},
  { id: 'h3', name: 'Bergerie', rooms: [
    { id: 'r7', name: 'Grande Chambre', bedType: 'double', beds: 2, guestIds: ['g4', 'g10'] },
    { id: 'r8', name: 'Chambre Enfants', bedType: 'single', beds: 3, guestIds: [] },
  ]},
];

export const INITIAL_TABLES: Table[] = [
  { id: 't1', name: 'Table des Mariés', seats: 10, shape: 'rect', x: 700, y: 170, rotation: 0, assignments: [] },
  { id: 't2', name: 'Famille', seats: 14, shape: 'rect', x: 320, y: 520, rotation: 0, assignments: [
    { guestId: 'g1', seat: 0 }, { guestId: 'g2', seat: 1 }, { guestId: 'g10', seat: 2 }, { guestId: 'g7', seat: 3 },
  ]},
  { id: 't3', name: 'Amis Proches', seats: 12, shape: 'rect', x: 700, y: 560, rotation: 0, assignments: [
    { guestId: 'g3', seat: 0 }, { guestId: 'g4', seat: 1 }, { guestId: 'g8', seat: 2 }, { guestId: 'g11', seat: 3 },
  ]},
  { id: 't4', name: 'Table 4', seats: 12, shape: 'rect', x: 1080, y: 520, rotation: 0, assignments: [
    { guestId: 'g5', seat: 0 }, { guestId: 'g6', seat: 1 },
  ]},
];

export const ASSIGNEES: Assignee[] = [
  { id: 'marie', label: 'Marié', color: '#3b82f6' },
  { id: 'elle', label: 'Elle', color: '#ec4899' },
  { id: 'famille', label: 'Famille', color: '#f59e0b' },
  { id: 'prestataire', label: 'Prestataire', color: '#8b5cf6' },
];

export const INITIAL_TODOS: TodoGroup[] = [
  { id: 'todo1', title: 'Traiteur', tasks: [
    { id: 'tk1', label: 'Contacter 3 traiteurs pour devis', done: true, assignee: 'marie', dueDate: '2026-06-01' },
    { id: 'tk2', label: 'Organiser dégustation', done: false, assignee: 'marie', dueDate: '2026-09-01' },
    { id: 'tk3', label: 'Valider le menu définitif', done: false, assignee: 'elle', dueDate: '2027-02-01' },
    { id: 'tk4', label: 'Signer le contrat', done: false, assignee: 'marie', dueDate: '2026-10-15' },
  ]},
  { id: 'todo2', title: 'Photographie & Vidéo', tasks: [
    { id: 'tk5', label: 'Sélectionner photographe', done: true, assignee: 'elle', dueDate: '2026-07-01' },
    { id: 'tk6', label: 'Préparer liste de photos', done: false, assignee: 'elle', dueDate: '2027-05-01' },
    { id: 'tk7', label: 'Confirmer planning du jour J', done: false, assignee: 'marie', dueDate: '2027-06-15' },
  ]},
  { id: 'todo3', title: 'Décoration & Fleurs', tasks: [
    { id: 'tk8', label: 'Définir le thème floral', done: false, assignee: 'elle', dueDate: '2026-11-01' },
    { id: 'tk9', label: 'Rencontrer fleuriste', done: false, assignee: 'elle', dueDate: '2026-12-01' },
    { id: 'tk10', label: 'Commander la tente', done: false, assignee: 'famille', dueDate: '2027-01-01' },
    { id: 'tk11', label: 'Organiser éclairage extérieur', done: false, assignee: 'prestataire', dueDate: '2027-03-01' },
  ]},
  { id: 'todo4', title: 'Logistique & Invités', tasks: [
    { id: 'tk12', label: 'Envoyer save the date', done: true, assignee: 'marie', dueDate: '2026-09-01' },
    { id: 'tk13', label: 'Envoyer les invitations', done: false, assignee: 'marie', dueDate: '2027-01-16' },
    { id: 'tk14', label: 'Confirmer hébergements', done: false, assignee: 'famille', dueDate: '2027-04-01' },
    { id: 'tk15', label: 'Finaliser plan de table', done: false, assignee: 'elle', dueDate: '2027-06-01' },
  ]},
  { id: 'todo5', title: 'Tenues', tasks: [
    { id: 'tk16', label: 'Premiers essayages robe', done: true, assignee: 'elle', dueDate: '2026-10-01' },
    { id: 'tk17', label: 'Commande costume', done: false, assignee: 'marie', dueDate: '2027-02-01' },
    { id: 'tk18', label: 'Essayage final robe', done: false, assignee: 'elle', dueDate: '2027-06-01' },
  ]},
];

export const INITIAL_BUDGET: Budget = {
  categories: [
    { id: 'b1', name: 'Traiteur', estimated: 18000, items: [{ id: 'bi1', label: 'Acompte traiteur', amount: 4500, date: '2026-10-01' }] },
    { id: 'b2', name: 'Photographie', estimated: 3500, items: [{ id: 'bi2', label: 'Réservation photographe', amount: 800, date: '2026-09-15' }] },
    { id: 'b3', name: 'Tente & Mobilier', estimated: 6000, items: [] },
    { id: 'b4', name: 'Lumières', estimated: 2500, items: [] },
    { id: 'b5', name: 'DJ & Musique', estimated: 2000, items: [{ id: 'bi3', label: 'Acompte DJ', amount: 500, date: '2026-11-01' }] },
    { id: 'b6', name: 'Fleurs & Décoration', estimated: 3000, items: [] },
    { id: 'b7', name: "Voiture de l'église", estimated: 800, items: [] },
  ],
};

export const CATS: Record<string, { label: string; short: string }> = {
  'famille-moi': { label: 'Famille (moi)', short: 'Fam. Moi' },
  'famille-elle': { label: 'Famille (elle)', short: 'Fam. Elle' },
  'amis': { label: 'Amis', short: 'Amis' },
  'temoins': { label: 'Témoins', short: 'Témoins' },
  'enfants': { label: 'Enfants', short: 'Enfants' },
};

export const RSVP_LABELS: Record<string, string> = {
  confirmed: 'Confirmé',
  pending: 'En attente',
  declined: 'Décliné',
};

export const EVENT_LABELS: Record<string, string> = {
  rehearsal: 'Répétition',
  ceremony: 'Cérémonie',
  dinner: 'Dîner',
};
