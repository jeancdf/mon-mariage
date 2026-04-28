import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssigneeId, Task } from '../../data/types';
import { TodosApiService } from '../../data/todos-api.service';
import { WeddingStore } from '../../data/store';
import { ASSIGNEES } from '../../data/seed';
import { ASSIGNEE_OPTIONS, fmtShortDate } from '../../shared/wedding-utils';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-todos',
  standalone: true,
  imports: [FormsModule, IconComponent],
  templateUrl: './todos.component.html',
})
export class TodosComponent {
  readonly store = inject(WeddingStore);
  private readonly todosApi = inject(TodosApiService);
  readonly assignees = ASSIGNEES;
  readonly assigneeOptions = ASSIGNEE_OPTIONS;
  readonly fmtShortDate = fmtShortDate;

  expanded: Record<string, boolean> = Object.fromEntries(this.store.todos().map(group => [group.id, true]));
  addingGroup = false;
  groupName = '';
  addingTaskFor: string | null = null;
  taskForm: { label: string; assignee: AssigneeId; dueDate: string } = { label: '', assignee: 'marie', dueDate: '' };

  readonly totals = computed(() => {
    const todos = this.store.todos();
    const total = todos.reduce((sum, group) => sum + group.tasks.length, 0);
    const done = todos.reduce((sum, group) => sum + group.tasks.filter(task => task.done).length, 0);
    return { total, done, percent: total ? (done / total) * 100 : 0 };
  });

  assigneeColor(id: AssigneeId): string {
    return this.assignees.find(assignee => assignee.id === id)?.color ?? '#888';
  }

  completedCount(tasks: Task[]): number {
    return tasks.filter(task => task.done).length;
  }

  toggleGroup(groupId: string): void {
    this.expanded = { ...this.expanded, [groupId]: this.expanded[groupId] === false };
  }

  async addGroup(): Promise<void> {
    const title = this.groupName.trim();
    if (!title) return;
    const todos = await this.todosApi.createGroup(title);
    this.store.replaceTodos(todos);
    this.groupName = '';
    this.addingGroup = false;
  }

  async deleteGroup(id: string): Promise<void> {
    const todos = await this.todosApi.deleteGroup(id);
    this.store.replaceTodos(todos);
  }

  async toggleDone(_groupId: string, task: Task): Promise<void> {
    const todos = await this.todosApi.updateTask({ ...task, done: !task.done });
    this.store.replaceTodos(todos);
  }

  async updateAssignee(_groupId: string, task: Task, assignee: AssigneeId): Promise<void> {
    const todos = await this.todosApi.updateTask({ ...task, assignee });
    this.store.replaceTodos(todos);
  }

  async addTask(groupId: string): Promise<void> {
    const label = this.taskForm.label.trim();
    if (!label) return;
    const todos = await this.todosApi.createTask(groupId, {
      label,
      done: false,
      assignee: this.taskForm.assignee,
      dueDate: this.taskForm.dueDate,
    });
    this.store.replaceTodos(todos);
    this.taskForm = { label: '', assignee: 'marie', dueDate: '' };
    this.addingTaskFor = null;
  }

  async deleteTask(id: string): Promise<void> {
    const todos = await this.todosApi.deleteTask(id);
    this.store.replaceTodos(todos);
  }
}
