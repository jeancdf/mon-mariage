import { Module } from '@nestjs/common';
import { BudgetModule } from '../budget/budget.module';
import { GuestsModule } from '../guests/guests.module';
import { HousingModule } from '../housing/housing.module';
import { SeatingModule } from '../seating/seating.module';
import { TodosModule } from '../todos/todos.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [GuestsModule, HousingModule, SeatingModule, BudgetModule, TodosModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
