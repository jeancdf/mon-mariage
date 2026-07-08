import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Task, TodoGroup } from './types';

@Injectable({ providedIn: 'root' })
export class TodosApiService {
  private readonly http = inject(HttpClient);

  async loadTodos(): Promise<TodoGroup[]> {
    return firstValueFrom(this.http.get<TodoGroup[]>('/api/todos'));
  }

  async createGroup(title: string): Promise<TodoGroup[]> {
    return firstValueFrom(this.http.post<TodoGroup[]>('/api/todos/groups', { title }));
  }

  async updateGroup(group: TodoGroup): Promise<TodoGroup[]> {
    return firstValueFrom(this.http.patch<TodoGroup[]>(`/api/todos/groups/${group.id}`, group));
  }

  async deleteGroup(id: string): Promise<TodoGroup[]> {
    return firstValueFrom(this.http.delete<TodoGroup[]>(`/api/todos/groups/${id}`));
  }

  async createTask(groupId: string, task: Omit<Task, 'id'>): Promise<TodoGroup[]> {
    return firstValueFrom(this.http.post<TodoGroup[]>(`/api/todos/groups/${groupId}/tasks`, task));
  }

  async updateTask(task: Task): Promise<TodoGroup[]> {
    return firstValueFrom(this.http.patch<TodoGroup[]>(`/api/todos/tasks/${task.id}`, task));
  }

  async deleteTask(id: string): Promise<TodoGroup[]> {
    return firstValueFrom(this.http.delete<TodoGroup[]>(`/api/todos/tasks/${id}`));
  }
}
