import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BudgetCategory } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { gid } from '../../data/seed';
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

  addCategory(): void {
    const name = this.categoryForm.name.trim();
    if (!name) return;
    this.store.addBudgetCat({ id: gid(), name, estimated: Number(this.categoryForm.estimated) || 0, items: [] });
    this.categoryForm = { name: '', estimated: '' };
    this.addingCategory = false;
  }

  updateEstimate(category: BudgetCategory, value: number | string): void {
    this.store.updateBudgetCat({ ...category, estimated: Number(value) || 0 });
    this.editingEstimateFor = null;
  }

  addItem(categoryId: string): void {
    const label = this.itemForm.label.trim();
    if (!label || !this.itemForm.amount) return;
    this.store.addBudgetItem(categoryId, {
      id: gid(),
      label,
      amount: Number(this.itemForm.amount) || 0,
      date: this.itemForm.date,
    });
    this.itemForm = { label: '', amount: '', date: '' };
    this.addingItemFor = null;
  }
}
