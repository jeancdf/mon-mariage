export type Rsvp = 'confirmed' | 'pending' | 'declined';
export type GuestCategory = 'famille-moi' | 'famille-elle' | 'amis' | 'temoins' | 'enfants';
export type EventKey = 'rehearsal' | 'ceremony' | 'dinner';
export type BedType = 'double' | 'single';
export type AssigneeId = 'marie' | 'elle' | 'famille' | 'prestataire';
export type ThemeKey = 'blanc' | 'nuit' | 'ivoire';

export interface Kid {
  id: string;
  name: string;
  age: number | string;
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  category: GuestCategory;
  rsvp: Rsvp;
  hasPlusOne: boolean;
  plusOneName: string;
  kids: Kid[];
  dietary: string;
  events: EventKey[];
  transport: string;
  notes: string;
}

export interface Room {
  id: string;
  name: string;
  bedType: BedType;
  beds: number;
  guestIds: string[];
}

export interface House {
  id: string;
  name: string;
  rooms: Room[];
}

export interface Table {
  id: string;
  name: string;
  seats: number;
  guestIds: string[];
}

export interface Task {
  id: string;
  label: string;
  done: boolean;
  assignee: AssigneeId;
  dueDate: string;
}

export interface TodoGroup {
  id: string;
  title: string;
  tasks: Task[];
}

export interface BudgetItem {
  id: string;
  label: string;
  amount: number;
  date: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  estimated: number;
  items: BudgetItem[];
}

export interface Budget {
  categories: BudgetCategory[];
}

export interface Assignee {
  id: AssigneeId;
  label: string;
  color: string;
}

export type VendorCategoryKey =
  | 'traiteur'
  | 'photographe'
  | 'videaste'
  | 'dj'
  | 'musique'
  | 'fleuriste'
  | 'location-vaisselle'
  | 'decoration'
  | 'coiffure-maquillage'
  | 'voiture'
  | 'officiant';

export type VendorStatus =
  | 'a-contacter'
  | 'contacte'
  | 'devis-demande'
  | 'devis-recu'
  | 'reserve'
  | 'acompte-paye'
  | 'solde-paye'
  | 'ecarte';

export type VendorDetails = Record<string, string | number | boolean>;

export interface Vendor {
  id: string;
  category: VendorCategoryKey;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  address: string;
  priceEstimate: number;
  priceFinal: number;
  depositAmount: number;
  depositPaid: boolean;
  balanceDueDate: string;
  status: VendorStatus;
  meetingDate: string;
  contractSigned: boolean;
  contractUrl: string;
  rating: number;
  notes: string;
  details: VendorDetails;
}
