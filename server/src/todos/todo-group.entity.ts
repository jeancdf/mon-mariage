import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TodoTaskEntity } from './todo-task.entity';

@Entity({ name: 'todo_groups' })
export class TodoGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @OneToMany(() => TodoTaskEntity, task => task.group, {
    cascade: true,
  })
  tasks!: TodoTaskEntity[];
}
