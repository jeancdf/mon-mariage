import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget, BudgetCategory, BudgetItem } from '../planner/planner-state.entity';
import { BudgetCategoryEntity } from './budget-category.entity';
import { BudgetItemEntity } from './budget-item.entity';

@Injectable()
export class BudgetService {
  constructor(
    @InjectRepository(BudgetCategoryEntity)
    private readonly categoriesRepository: Repository<BudgetCategoryEntity>,
    @InjectRepository(BudgetItemEntity)
    private readonly itemsRepository: Repository<BudgetItemEntity>,
  ) {}

  async find(): Promise<Budget> {
    const categories = await this.categoriesRepository.find({
      relations: { items: true },
      order: { name: 'ASC', items: { date: 'ASC' } },
    });
    return { categories: categories.map(category => this.mapCategory(category)) };
  }

  async createCategory(input: { name: string; estimated: number }): Promise<Budget> {
    await this.categoriesRepository.save(this.categoriesRepository.create({
      name: String(input.name ?? '').trim(),
      estimated: Number(input.estimated) || 0,
    }));
    return this.find();
  }

  async updateCategory(id: string, input: Partial<BudgetCategory>): Promise<Budget> {
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Budget category not found');
    category.name = String(input.name ?? category.name).trim();
    category.estimated = Number(input.estimated ?? category.estimated) || 0;
    await this.categoriesRepository.save(category);
    return this.find();
  }

  async deleteCategory(id: string): Promise<Budget> {
    const result = await this.categoriesRepository.delete(id);
    if (!result.affected) throw new NotFoundException('Budget category not found');
    return this.find();
  }

  async createItem(categoryId: string, input: Omit<BudgetItem, 'id'>): Promise<Budget> {
    const category = await this.categoriesRepository.findOne({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Budget category not found');
    await this.itemsRepository.save(this.itemsRepository.create({
      categoryId,
      label: String(input.label ?? '').trim(),
      amount: Number(input.amount) || 0,
      date: String(input.date ?? ''),
    }));
    return this.find();
  }

  async updateItem(id: string, input: Partial<BudgetItem>): Promise<Budget> {
    const item = await this.itemsRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Budget item not found');
    item.label = String(input.label ?? item.label).trim();
    item.amount = Number(input.amount ?? item.amount) || 0;
    item.date = String(input.date ?? item.date);
    await this.itemsRepository.save(item);
    return this.find();
  }

  async deleteItem(id: string): Promise<Budget> {
    const result = await this.itemsRepository.delete(id);
    if (!result.affected) throw new NotFoundException('Budget item not found');
    return this.find();
  }

  private mapCategory(category: BudgetCategoryEntity): BudgetCategory {
    return {
      id: category.id,
      name: category.name,
      estimated: Number(category.estimated) || 0,
      items: (category.items ?? []).map(item => ({
        id: item.id,
        label: item.label,
        amount: Number(item.amount) || 0,
        date: item.date,
      })),
    };
  }
}
