import { Module } from '@nestjs/common';
import { BudgetModule } from '../budget/budget.module';
import { GuestsModule } from '../guests/guests.module';
import { HousingModule } from '../housing/housing.module';
import { SeatingModule } from '../seating/seating.module';
import { TodosModule } from '../todos/todos.module';
import { VendorsModule } from '../vendors/vendors.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { EventConfigModule } from '../event-config/event-config.module';
import { FinalWeeksModule } from '../final-weeks/final-weeks.module';

@Module({
  imports: [GuestsModule, HousingModule, SeatingModule, BudgetModule, TodosModule, VendorsModule, EventConfigModule, FinalWeeksModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
