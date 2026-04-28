import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssigneeId, Task } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { ASSIGNEES, gid } from '../../data/seed';
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

  addGroup(): void {
    const title = this.groupName.trim();
    if (!title) return;
    const id = gid();
    this.store.addTodoGroup({ id, title, tasks: [] });
    this.expanded = { ...this.expanded, [id]: true };
    this.groupName = '';
    this.addingGroup = false;
  }

  toggleDone(groupId: string, task: Task): void {
    this.store.updateTodoTask(groupId, { ...task, done: !task.done });
  }

  updateAssignee(groupId: string, task: Task, assignee: AssigneeId): void {
    this.store.updateTodoTask(groupId, { ...task, assignee });
  }

  addTask(groupId: string): void {
    const label = this.taskForm.label.trim();
    if (!label) return;
    this.store.addTodoTask(groupId, {
      id: gid(),
      label,
      done: false,
      assignee: this.taskForm.assignee,
      dueDate: this.taskForm.dueDate,
    });
    this.taskForm = { label: '', assignee: 'marie', dueDate: '' };
    this.addingTaskFor = null;
  }
}
