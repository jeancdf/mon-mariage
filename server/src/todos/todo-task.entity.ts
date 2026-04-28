import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AssigneeId } from '../planner/planner-state.entity';
import { TodoGroupEntity } from './todo-group.entity';

@Entity({ name: 'todo_tasks' })
export class TodoTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'boolean', default: false })
  done!: boolean;

  @Column({ type: 'text', default: 'marie' })
  assignee!: AssigneeId;

  @Column({ type: 'text', default: '' })
  dueDate!: string;

  @ManyToOne(() => TodoGroupEntity, group => group.tasks, {
    onDelete: 'CASCADE',
  })
  group!: TodoGroupEntity;

  @Column({ type: 'uuid' })
  groupId!: string;
}
