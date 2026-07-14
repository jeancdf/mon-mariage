import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TaskAssigneeEntity } from './task-assignee.entity';

export type OperationalTaskCategory = 'groceries' | 'errands' | 'cooking' | 'cleaning' | 'wedding' | 'other';
export type OperationalTaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

@Entity({ name: 'final_week_tasks' })
export class OperationalTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', default: '' })
  notes!: string;

  @Column({ type: 'text', default: 'other' })
  category!: OperationalTaskCategory;

  @Column({ type: 'timestamptz' })
  scheduledAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ type: 'text', default: 'todo' })
  status!: OperationalTaskStatus;

  @Column({ type: 'uuid', nullable: true })
  recurrenceGroupId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByAccountId!: string | null;

  @OneToMany(() => TaskAssigneeEntity, assignee => assignee.task, { cascade: true })
  assignees!: TaskAssigneeEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
