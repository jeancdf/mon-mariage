import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TodoGroup } from '../planner/planner-state.entity';
import { TodoGroupEntity } from './todo-group.entity';
import { TodoTaskEntity } from './todo-task.entity';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(TodoGroupEntity)
    private readonly groupsRepository: Repository<TodoGroupEntity>,
    @InjectRepository(TodoTaskEntity)
    private readonly tasksRepository: Repository<TodoTaskEntity>,
  ) {}

  async findAll(): Promise<TodoGroup[]> {
    const groups = await this.groupsRepository.find({
      relations: { tasks: true },
      order: { title: 'ASC', tasks: { dueDate: 'ASC' } },
    });
    return groups.map(group => this.mapGroup(group));
  }

  async createGroup(input: { title: string }): Promise<TodoGroup[]> {
    await this.groupsRepository.save(this.groupsRepository.create({
      title: String(input.title ?? '').trim(),
    }));
    return this.findAll();
  }

  async updateGroup(id: string, input: Partial<TodoGroup>): Promise<TodoGroup[]> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Todo group not found');
    group.title = String(input.title ?? group.title).trim();
    await this.groupsRepository.save(group);
    return this.findAll();
  }

  async deleteGroup(id: string): Promise<TodoGroup[]> {
    const result = await this.groupsRepository.delete(id);
    if (!result.affected) throw new NotFoundException('Todo group not found');
    return this.findAll();
  }

  async createTask(groupId: string, input: Omit<Task, 'id'>): Promise<TodoGroup[]> {
    const group = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Todo group not found');
    await this.tasksRepository.save(this.tasksRepository.create({
      groupId,
      label: String(input.label ?? '').trim(),
      done: Boolean(input.done),
      assignee: input.assignee ?? 'marie',
      dueDate: String(input.dueDate ?? ''),
    }));
    return this.findAll();
  }

  async updateTask(id: string, input: Partial<Task>): Promise<TodoGroup[]> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Todo task not found');
    task.label = String(input.label ?? task.label).trim();
    task.done = input.done ?? task.done;
    task.assignee = input.assignee ?? task.assignee;
    task.dueDate = String(input.dueDate ?? task.dueDate);
    await this.tasksRepository.save(task);
    return this.findAll();
  }

  async deleteTask(id: string): Promise<TodoGroup[]> {
    const result = await this.tasksRepository.delete(id);
    if (!result.affected) throw new NotFoundException('Todo task not found');
    return this.findAll();
  }

  private mapGroup(group: TodoGroupEntity): TodoGroup {
    return {
      id: group.id,
      title: group.title,
      tasks: (group.tasks ?? []).map(task => ({
        id: task.id,
        label: task.label,
        done: task.done,
        assignee: task.assignee,
        dueDate: task.dueDate,
      })),
    };
  }
}
