import { Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Budget, BudgetCategory, BudgetItem } from '../planner/planner-state.entity';
import { BudgetCategoryEntity } from './budget-category.entity';
import { BudgetItemEntity } from './budget-item.entity';

const DEFAULT_BUDGET: Budget = {
  categories: [
    { id: 'b1', name: 'Traiteur', estimated: 0, items: [] },
    { id: 'b2', name: 'Photographie', estimated: 0, items: [] },
    { id: 'b3', name: 'Tente & Mobilier', estimated: 0, items: [] },
    { id: 'b4', name: 'Lumières', estimated: 0, items: [] },
    { id: 'b5', name: 'DJ & Musique', estimated: 0, items: [] },
    { id: 'b6', name: 'Fleurs & Décoration', estimated: 0, items: [] },
    { id: 'b7', name: "Voiture de l'église", estimated: 0, items: [] },
  ],
};

// Arbitrary constant identifying the "seed budget defaults" critical section.
const SEED_LOCK_KEY = 728_431_002;

@Injectable()
export class BudgetService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(BudgetCategoryEntity)
    private readonly categoriesRepository: Repository<BudgetCategoryEntity>,
    @InjectRepository(BudgetItemEntity)
    private readonly itemsRepository: Repository<BudgetItemEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // Seeding runs once here, before the HTTP listener opens, instead of on
  // every find(): the old check-then-insert inside find() raced when the
  // first two requests hit an empty database simultaneously and inserted
  // the defaults twice. The advisory lock also covers multiple backend
  // instances starting against the same database.
  async onApplicationBootstrap(): Promise<void> {
    await this.dataSource.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [SEED_LOCK_KEY]);
      const count = await manager.count(BudgetCategoryEntity);
      if (count > 0) return;
      for (const category of DEFAULT_BUDGET.categories) {
        await manager.save(manager.create(BudgetCategoryEntity, {
          name: category.name,
          estimated: 0,
        }));
      }
    });
  }

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
