import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetCategoryEntity } from './budget-category.entity';
import { BudgetController } from './budget.controller';
import { BudgetItemEntity } from './budget-item.entity';
import { BudgetService } from './budget.service';

@Module({
  imports: [TypeOrmModule.forFeature([BudgetCategoryEntity, BudgetItemEntity])],
  controllers: [BudgetController],
  providers: [BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
