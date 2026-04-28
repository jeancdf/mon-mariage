import { Injectable } from '@nestjs/common';
import { BudgetService } from '../budget/budget.service';
import { GuestsService } from '../guests/guests.service';
import { HousingService } from '../housing/housing.service';
import { SeatingService } from '../seating/seating.service';
import { TodosService } from '../todos/todos.service';

export interface DashboardSummary {
  guests: {
    total: number;
    confirmed: number;
    pending: number;
    declined: number;
  };
  housing: {
    occupiedBeds: number;
    totalBeds: number;
  };
  seating: {
    seated: number;
    totalSeats: number;
  };
  budget: {
    totalEstimated: number;
    totalSpent: number;
    categories: { id: string; name: string; estimated: number; spent: number }[];
  };
  todos: {
    total: number;
    done: number;
  };
  daysRemaining: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly guestsService: GuestsService,
    private readonly housingService: HousingService,
    private readonly seatingService: SeatingService,
    private readonly budgetService: BudgetService,
    private readonly todosService: TodosService,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const [guests, houses, tables, budget, todos] = await Promise.all([
      this.guestsService.findAll(),
      this.housingService.findAll(),
      this.seatingService.findAll(),
      this.budgetService.find(),
      this.todosService.findAll(),
    ]);

    const confirmed = guests.filter(guest => guest.rsvp === 'confirmed').length;
    const pending = guests.filter(guest => guest.rsvp === 'pending').length;
    const declined = guests.filter(guest => guest.rsvp === 'declined').length;
    const totalBeds = houses.reduce((sum, house) =>
      sum + house.rooms.reduce((roomSum, room) => roomSum + room.beds * (room.bedType === 'double' ? 2 : 1), 0), 0);
    const occupiedBeds = houses.reduce((sum, house) =>
      sum + house.rooms.reduce((roomSum, room) => roomSum + room.guestIds.length, 0), 0);
    const totalSeats = tables.reduce((sum, table) => sum + table.seats, 0);
    const seated = tables.reduce((sum, table) => sum + table.guestIds.length, 0);
    const categories = budget.categories.map(category => ({
      id: category.id,
      name: category.name,
      estimated: category.estimated,
      spent: category.items.reduce((sum, item) => sum + item.amount, 0),
    }));
    const totalEstimated = categories.reduce((sum, category) => sum + category.estimated, 0);
    const totalSpent = categories.reduce((sum, category) => sum + category.spent, 0);
    const totalTasks = todos.reduce((sum, group) => sum + group.tasks.length, 0);
    const doneTasks = todos.reduce((sum, group) => sum + group.tasks.filter(task => task.done).length, 0);

    return {
      guests: {
        total: guests.length,
        confirmed,
        pending,
        declined,
      },
      housing: {
        occupiedBeds,
        totalBeds,
      },
      seating: {
        seated,
        totalSeats,
      },
      budget: {
        totalEstimated,
        totalSpent,
        categories,
      },
      todos: {
        total: totalTasks,
        done: doneTasks,
      },
      daysRemaining: Math.ceil((new Date('2027-07-16').getTime() - Date.now()) / 86_400_000),
    };
  }
}
