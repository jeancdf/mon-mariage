import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssigneeId, Task, TodoGroup } from '../../data/types';
import { TodosApiService } from '../../data/todos-api.service';
import { WeddingStore } from '../../data/store';
import { ASSIGNEES } from '../../data/seed';
import { ASSIGNEE_OPTIONS, fmtShortDate } from '../../shared/wedding-utils';
import { IconComponent } from '../../shared/icon.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ToastService } from '../../shared/toast.service';
import { AutofocusDirective } from '../../shared/autofocus.directive';

@Component({
  selector: 'app-todos',
  standalone: true,
  imports: [FormsModule, IconComponent, ConfirmDialogComponent, AutofocusDirective],
  templateUrl: './todos.component.html',
})
export class TodosComponent {
  readonly store = inject(WeddingStore);
  private readonly todosApi = inject(TodosApiService);
  private readonly toast = inject(ToastService);
  readonly assignees = ASSIGNEES;
  readonly assigneeOptions = ASSIGNEE_OPTIONS;
  readonly fmtShortDate = fmtShortDate;
  readonly today = new Date().toISOString().slice(0, 10);

  expanded: Record<string, boolean> = Object.fromEntries(this.store.todos().map(group => [group.id, true]));
  addingGroup = false;
  groupName = '';
  addingTaskFor: string | null = null;
  taskForm: { label: string; assignee: AssigneeId; dueDate: string } = { label: '', assignee: 'marie', dueDate: '' };
  editingTaskId: string | null = null;
  taskLabelDraft = '';
  editingGroupId: string | null = null;
  groupTitleDraft = '';
  groupPendingDeletion: TodoGroup | null = null;

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

  sortedTasks(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate !== b.dueDate) return a.dueDate ? -1 : 1;
      return a.label.localeCompare(b.label, 'fr');
    });
  }

  isOverdue(task: Task): boolean {
    return Boolean(task.dueDate) && !task.done && task.dueDate < this.today;
  }

  toggleGroup(groupId: string): void {
    this.expanded = { ...this.expanded, [groupId]: this.expanded[groupId] === false };
  }

  async addGroup(): Promise<void> {
    const title = this.groupName.trim();
    if (!title) return;
    try {
      const todos = await this.todosApi.createGroup(title);
      this.store.replaceTodos(todos);
      this.groupName = '';
      this.addingGroup = false;
    } catch {
      this.toast.error('Impossible de créer la liste.');
    }
  }

  startEditingGroup(group: TodoGroup): void {
    this.editingGroupId = group.id;
    this.groupTitleDraft = group.title;
  }

  cancelEditingGroup(): void {
    this.editingGroupId = null;
    this.groupTitleDraft = '';
  }

  async saveGroupTitle(group: TodoGroup): Promise<void> {
    const title = this.groupTitleDraft.trim();
    if (!title) return;
    try {
      const todos = await this.todosApi.updateGroup({ ...group, title });
      this.store.replaceTodos(todos);
      this.cancelEditingGroup();
    } catch {
      this.toast.error('Impossible de modifier la liste.');
    }
  }

  requestDeleteGroup(group: TodoGroup): void {
    this.groupPendingDeletion = group;
  }

  cancelDeleteGroup(): void {
    this.groupPendingDeletion = null;
  }

  async confirmDeleteGroup(): Promise<void> {
    const group = this.groupPendingDeletion;
    if (!group) return;
    this.groupPendingDeletion = null;
    await this.deleteGroup(group.id);
  }

  private async deleteGroup(id: string): Promise<void> {
    try {
      const todos = await this.todosApi.deleteGroup(id);
      this.store.replaceTodos(todos);
    } catch {
      this.toast.error('Impossible de supprimer la liste.');
    }
  }

  async toggleDone(_groupId: string, task: Task): Promise<void> {
    try {
      const todos = await this.todosApi.updateTask({ ...task, done: !task.done });
      this.store.replaceTodos(todos);
    } catch {
      this.toast.error('Impossible de mettre à jour la tâche.');
    }
  }

  async updateAssignee(_groupId: string, task: Task, assignee: AssigneeId): Promise<void> {
    try {
      const todos = await this.todosApi.updateTask({ ...task, assignee });
      this.store.replaceTodos(todos);
    } catch {
      this.toast.error('Impossible de mettre à jour la tâche.');
    }
  }

  startEditingTask(task: Task): void {
    this.editingTaskId = task.id;
    this.taskLabelDraft = task.label;
  }

  cancelEditingTask(): void {
    this.editingTaskId = null;
    this.taskLabelDraft = '';
  }

  async saveTaskLabel(task: Task): Promise<void> {
    const label = this.taskLabelDraft.trim();
    if (!label) return;
    try {
      const todos = await this.todosApi.updateTask({ ...task, label });
      this.store.replaceTodos(todos);
      this.cancelEditingTask();
    } catch {
      this.toast.error('Impossible de modifier la tâche.');
    }
  }

  async addTask(groupId: string): Promise<void> {
    const label = this.taskForm.label.trim();
    if (!label) return;
    try {
      const todos = await this.todosApi.createTask(groupId, {
        label,
        done: false,
        assignee: this.taskForm.assignee,
        dueDate: this.taskForm.dueDate,
      });
      this.store.replaceTodos(todos);
      this.taskForm = { label: '', assignee: 'marie', dueDate: '' };
      this.addingTaskFor = null;
    } catch {
      this.toast.error("Impossible d'ajouter la tâche.");
    }
  }

  async deleteTask(id: string): Promise<void> {
    try {
      const todos = await this.todosApi.deleteTask(id);
      this.store.replaceTodos(todos);
    } catch {
      this.toast.error('Impossible de supprimer la tâche.');
    }
  }
}
