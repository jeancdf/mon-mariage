import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BudgetCategoryEntity } from './budget-category.entity';

@Entity({ name: 'budget_items' })
export class BudgetItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'numeric', default: 0 })
  amount!: number;

  @Column({ type: 'text', default: '' })
  date!: string;

  @ManyToOne(() => BudgetCategoryEntity, category => category.items, {
    onDelete: 'CASCADE',
  })
  category!: BudgetCategoryEntity;

  @Column({ type: 'uuid' })
  categoryId!: string;
}
