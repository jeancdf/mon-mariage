import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type Rsvp = 'confirmed' | 'pending' | 'declined';
export type GuestCategory =
  | 'famille-moi'
  | 'famille-elle'
  | 'amis'
  | 'temoins'
  | 'enfants';
export type EventKey = 'rehearsal' | 'ceremony' | 'dinner';
export type OrganizationRole = 'parent' | 'sibling' | 'witness' | 'friend_cousin' | 'other';

export interface Kid {
  id: string;
  name: string;
  age: number | string;
}

@Entity({ name: 'guests' })
export class GuestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  firstName!: string;

  @Column({ type: 'text', default: '' })
  lastName!: string;

  @Column({ type: 'text', default: '' })
  email!: string;

  @Column({ type: 'text', default: 'other' })
  organizationRole!: OrganizationRole;

  @Column({ type: 'text' })
  category!: GuestCategory;

  @Column({ type: 'text', default: 'pending' })
  rsvp!: Rsvp;

  @Column({ type: 'boolean', default: false })
  hasPlusOne!: boolean;

  @Column({ type: 'text', default: '' })
  plusOneName!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  kids!: Kid[];

  @Column({ type: 'text', default: '' })
  dietary!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  events!: EventKey[];

  @Column({ type: 'text', default: '' })
  transport!: string;

  @Column({ type: 'text', default: '' })
  notes!: string;
}
