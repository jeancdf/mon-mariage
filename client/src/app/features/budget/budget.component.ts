import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BudgetCategory, BudgetItem } from '../../data/types';
import { BudgetApiService } from '../../data/budget-api.service';
import { WeddingStore } from '../../data/store';
import { fmtCurrency, fmtDate } from '../../shared/wedding-utils';
import { IconComponent } from '../../shared/icon.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ToastService } from '../../shared/toast.service';
import { AutofocusDirective } from '../../shared/autofocus.directive';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [DecimalPipe, FormsModule, IconComponent, ConfirmDialogComponent, AutofocusDirective],
  templateUrl: './budget.component.html',
})
export class BudgetComponent {
  readonly store = inject(WeddingStore);
  private readonly budgetApi = inject(BudgetApiService);
  private readonly toast = inject(ToastService);
  readonly fmtCurrency = fmtCurrency;
  readonly fmtDate = fmtDate;

  addingCategory = false;
  categoryForm: { name: string; estimated: number | string } = { name: '', estimated: '' };
  expanded: Record<string, boolean> = {};
  addingItemFor: string | null = null;
  itemForm: { label: string; amount: number | string; date: string } = { label: '', amount: '', date: '' };
  editingEstimateFor: string | null = null;
  editingCategoryNameFor: string | null = null;
  categoryNameDraft = '';
  editingItemId: string | null = null;
  itemEditForm: { label: string; amount: number | string; date: string } = { label: '', amount: '', date: '' };
  categoryPendingDeletion: BudgetCategory | null = null;

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

  toggleCategory(categoryId: string): void {
    this.expanded = { ...this.expanded, [categoryId]: this.expanded[categoryId] === false };
  }

  async addCategory(): Promise<void> {
    const name = this.categoryForm.name.trim();
    if (!name) return;
    try {
      const budget = await this.budgetApi.createCategory({ name, estimated: Number(this.categoryForm.estimated) || 0 });
      this.store.replaceBudget(budget);
      this.categoryForm = { name: '', estimated: '' };
      this.addingCategory = false;
    } catch {
      this.toast.error("Impossible d'ajouter la catégorie.");
    }
  }

  async updateEstimate(category: BudgetCategory, value: number | string): Promise<void> {
    try {
      const budget = await this.budgetApi.updateCategory({ ...category, estimated: Number(value) || 0 });
      this.store.replaceBudget(budget);
      this.editingEstimateFor = null;
    } catch {
      this.toast.error('Impossible de modifier le budget estimé.');
    }
  }

  startRenamingCategory(category: BudgetCategory): void {
    this.editingCategoryNameFor = category.id;
    this.categoryNameDraft = category.name;
  }

  async renameCategory(category: BudgetCategory): Promise<void> {
    const name = this.categoryNameDraft.trim();
    if (!name) return;
    try {
      const budget = await this.budgetApi.updateCategory({ ...category, name });
      this.store.replaceBudget(budget);
      this.editingCategoryNameFor = null;
      this.categoryNameDraft = '';
    } catch {
      this.toast.error('Impossible de renommer le poste.');
    }
  }

  requestDeleteCategory(category: BudgetCategory): void {
    this.categoryPendingDeletion = category;
  }

  cancelDeleteCategory(): void {
    this.categoryPendingDeletion = null;
  }

  async confirmDeleteCategory(): Promise<void> {
    const category = this.categoryPendingDeletion;
    if (!category) return;
    this.categoryPendingDeletion = null;
    await this.deleteCategory(category.id);
  }

  private async deleteCategory(id: string): Promise<void> {
    try {
      const budget = await this.budgetApi.deleteCategory(id);
      this.store.replaceBudget(budget);
    } catch {
      this.toast.error('Impossible de supprimer la catégorie.');
    }
  }

  async addItem(categoryId: string): Promise<void> {
    const label = this.itemForm.label.trim();
    if (!label || !this.itemForm.amount) return;
    try {
      const budget = await this.budgetApi.createItem(categoryId, {
        label,
        amount: Number(this.itemForm.amount) || 0,
        date: this.itemForm.date,
      });
      this.store.replaceBudget(budget);
      this.itemForm = { label: '', amount: '', date: '' };
      this.addingItemFor = null;
    } catch {
      this.toast.error("Impossible d'ajouter la dépense.");
    }
  }

  startAddingItem(categoryId: string): void {
    this.expanded = { ...this.expanded, [categoryId]: true };
    this.addingItemFor = this.addingItemFor === categoryId ? null : categoryId;
  }

  startEditingItem(item: BudgetItem): void {
    this.editingItemId = item.id;
    this.itemEditForm = { label: item.label, amount: item.amount, date: item.date };
  }

  cancelEditingItem(): void {
    this.editingItemId = null;
    this.itemEditForm = { label: '', amount: '', date: '' };
  }

  async saveItem(item: BudgetItem): Promise<void> {
    const label = this.itemEditForm.label.trim();
    if (!label) return;
    try {
      const budget = await this.budgetApi.updateItem({
        ...item,
        label,
        amount: Number(this.itemEditForm.amount) || 0,
        date: this.itemEditForm.date,
      });
      this.store.replaceBudget(budget);
      this.cancelEditingItem();
    } catch {
      this.toast.error('Impossible de modifier la dépense.');
    }
  }

  async deleteItem(id: string): Promise<void> {
    try {
      const budget = await this.budgetApi.deleteItem(id);
      this.store.replaceBudget(budget);
    } catch {
      this.toast.error('Impossible de supprimer la dépense.');
    }
  }
}
