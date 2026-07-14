import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { AccountEntity } from '../../auth/entities/account.entity';
import { MealPlanEntity } from './meal-plan.entity';

@Entity({ name: 'final_week_meal_cooks' })
@Unique(['mealId', 'accountId'])
export class MealCookEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MealPlanEntity, meal => meal.cooks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mealId' })
  meal!: MealPlanEntity;

  @Column({ type: 'uuid' })
  mealId!: string;

  @ManyToOne(() => AccountEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account!: AccountEntity;

  @Column({ type: 'uuid' })
  accountId!: string;
}
