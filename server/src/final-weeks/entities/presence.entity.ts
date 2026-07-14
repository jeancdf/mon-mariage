import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type MealKind = 'breakfast' | 'lunch' | 'dinner';
export type MealSelections = Record<string, MealKind[]>;

@Entity({ name: 'final_week_presences' })
export class PresenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  guestPersonId!: string;

  @Column({ type: 'timestamptz', nullable: true })
  arrivalAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  departureAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  mealSelections!: MealSelections;

  @UpdateDateColumn()
  updatedAt!: Date;
}

