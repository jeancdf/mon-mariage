import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { AccountEntity } from '../../auth/entities/account.entity';
import { OperationalTaskEntity } from './operational-task.entity';

@Entity({ name: 'final_week_task_assignees' })
@Unique(['taskId', 'accountId'])
export class TaskAssigneeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => OperationalTaskEntity, task => task.assignees, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task!: OperationalTaskEntity;

  @Column({ type: 'uuid' })
  taskId!: string;

  @ManyToOne(() => AccountEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account!: AccountEntity;

  @Column({ type: 'uuid' })
  accountId!: string;
}
