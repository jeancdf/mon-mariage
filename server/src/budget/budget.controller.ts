import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Budget, BudgetCategory, BudgetItem } from '../planner/planner-state.entity';
import { BudgetService } from './budget.service';

@Controller('budget')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get()
  find(): Promise<Budget> {
    return this.budgetService.find();
  }

  @Post('categories')
  createCategory(@Body() body: { name: string; estimated: number }): Promise<Budget> {
    return this.budgetService.createCategory(body);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: Partial<BudgetCategory>): Promise<Budget> {
    return this.budgetService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string): Promise<Budget> {
    return this.budgetService.deleteCategory(id);
  }

  @Post('categories/:categoryId/items')
  createItem(@Param('categoryId') categoryId: string, @Body() body: Omit<BudgetItem, 'id'>): Promise<Budget> {
    return this.budgetService.createItem(categoryId, body);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() body: Partial<BudgetItem>): Promise<Budget> {
    return this.budgetService.updateItem(id, body);
  }

  @Delete('items/:id')
  deleteItem(@Param('id') id: string): Promise<Budget> {
    return this.budgetService.deleteItem(id);
  }
}
