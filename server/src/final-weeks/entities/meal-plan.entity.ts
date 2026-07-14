import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import type { MealKind } from './presence.entity';
import { MealCookEntity } from './meal-cook.entity';

@Entity({ name: 'final_week_meals' })
@Unique(['date', 'kind'])
export class MealPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'text' })
  kind!: MealKind;

  @Column({ type: 'text', default: '' })
  menu!: string;

  @Column({ type: 'text', default: '' })
  notes!: string;

  @OneToMany(() => MealCookEntity, cook => cook.meal, { cascade: true })
  cooks!: MealCookEntity[];

  @UpdateDateColumn()
  updatedAt!: Date;
}

