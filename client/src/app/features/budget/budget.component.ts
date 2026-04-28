import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BudgetCategory } from '../../data/types';
import { BudgetApiService } from '../../data/budget-api.service';
import { WeddingStore } from '../../data/store';
import { fmtCurrency, fmtDate } from '../../shared/wedding-utils';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [DecimalPipe, FormsModule, IconComponent],
  templateUrl: './budget.component.html',
})
export class BudgetComponent {
  readonly store = inject(WeddingStore);
  private readonly budgetApi = inject(BudgetApiService);
  readonly fmtCurrency = fmtCurrency;
  readonly fmtDate = fmtDate;

  addingCategory = false;
  categoryForm: { name: string; estimated: number | string } = { name: '', estimated: '' };
  addingItemFor: string | null = null;
  itemForm: { label: string; amount: number | string; date: string } = { label: '', amount: '', date: '' };
  editingEstimateFor: string | null = null;

  readonly totals = computed(() => {
    const categories = this.store.budget().categories;
    const estimated = categories.reduce((sum, category) => sum + category.estimated, 0);
    const spent = categories.reduce((sum, category) => sum + this.spentFor(category), 0);
    return { estimated, spent, remaining: estimated - spent, percent: estimated ? Math.min((spent / estimated) * 100, 100) : 0 };
  });

  spentFor(category: BudgetCategory): number {
    return category.items.reduce((sum, item) => sum + item.amount, 0);
  }

  percentFor(category: BudgetCategory): number {
    return category.estimated ? Math.min((this.spentFor(category) / category.estimated) * 100, 100) : 0;
  }

  async addCategory(): Promise<void> {
    const name = this.categoryForm.name.trim();
    if (!name) return;
    const budget = await this.budgetApi.createCategory({ name, estimated: Number(this.categoryForm.estimated) || 0 });
    this.store.replaceBudget(budget);
    this.categoryForm = { name: '', estimated: '' };
    this.addingCategory = false;
  }

  async updateEstimate(category: BudgetCategory, value: number | string): Promise<void> {
    const budget = await this.budgetApi.updateCategory({ ...category, estimated: Number(value) || 0 });
    this.store.replaceBudget(budget);
    this.editingEstimateFor = null;
  }

  async deleteCategory(id: string): Promise<void> {
    const budget = await this.budgetApi.deleteCategory(id);
    this.store.replaceBudget(budget);
  }

  async addItem(categoryId: string): Promise<void> {
    const label = this.itemForm.label.trim();
    if (!label || !this.itemForm.amount) return;
    const budget = await this.budgetApi.createItem(categoryId, {
      label,
      amount: Number(this.itemForm.amount) || 0,
      date: this.itemForm.date,
    });
    this.store.replaceBudget(budget);
    this.itemForm = { label: '', amount: '', date: '' };
    this.addingItemFor = null;
  }

  async deleteItem(id: string): Promise<void> {
    const budget = await this.budgetApi.deleteItem(id);
    this.store.replaceBudget(budget);
  }
}
