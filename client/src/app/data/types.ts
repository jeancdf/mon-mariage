export type Rsvp = 'confirmed' | 'pending' | 'declined';
export type GuestCategory = 'famille-moi' | 'famille-elle' | 'amis' | 'temoins' | 'enfants';
export type EventKey = 'rehearsal' | 'ceremony' | 'dinner';
export type BedType = 'double' | 'single';
export type AssigneeId = 'marie' | 'elle' | 'famille' | 'prestataire';
export type ThemeKey = 'blanc' | 'nuit' | 'ivoire';

export interface Kid {
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
