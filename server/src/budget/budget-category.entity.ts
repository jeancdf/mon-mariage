import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BudgetItemEntity } from './budget-item.entity';

@Entity({ name: 'budget_categories' })
export class BudgetCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'numeric', default: 0 })
  estimated!: number;

  @OneToMany(() => BudgetItemEntity, item => item.category, {
    cascade: true,
  })
  items!: BudgetItemEntity[];
}
