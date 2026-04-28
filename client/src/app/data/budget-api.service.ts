import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Budget, BudgetCategory, BudgetItem } from './types';

@Injectable({ providedIn: 'root' })
export class BudgetApiService {
  private readonly http = inject(HttpClient);

  async loadBudget(): Promise<Budget> {
    return firstValueFrom(this.http.get<Budget>('/api/budget'));
  }

  async createCategory(category: { name: string; estimated: number }): Promise<Budget> {
    return firstValueFrom(this.http.post<Budget>('/api/budget/categories', category));
  }

  async updateCategory(category: BudgetCategory): Promise<Budget> {
    return firstValueFrom(this.http.patch<Budget>(`/api/budget/categories/${category.id}`, category));
  }

  async deleteCategory(id: string): Promise<Budget> {
    return firstValueFrom(this.http.delete<Budget>(`/api/budget/categories/${id}`));
  }

  async createItem(categoryId: string, item: Omit<BudgetItem, 'id'>): Promise<Budget> {
    return firstValueFrom(this.http.post<Budget>(`/api/budget/categories/${categoryId}/items`, item));
  }

  async deleteItem(id: string): Promise<Budget> {
    return firstValueFrom(this.http.delete<Budget>(`/api/budget/items/${id}`));
  }
}
