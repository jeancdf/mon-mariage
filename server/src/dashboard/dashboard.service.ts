import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BudgetService } from '../budget/budget.service';
import { GuestsService } from '../guests/guests.service';
import { HousingService } from '../housing/housing.service';
import { SeatingService } from '../seating/seating.service';
import { TodosService } from '../todos/todos.service';
import { VendorsService } from '../vendors/vendors.service';

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
  vendors: {
    count: number;
    reserved: number;
    totalCommitted: number;
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
    private readonly vendorsService: VendorsService,
    private readonly configService: ConfigService,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const [guests, houses, tables, budget, todos, vendors] = await Promise.all([
      this.guestsService.findAll(),
      this.housingService.findAll(),
      this.seatingService.findAll(),
      this.budgetService.find(),
      this.todosService.findAll(),
      this.vendorsService.findAll(),
    ]);

    const guestPartySize = (guest: { hasPlusOne: boolean; kids?: unknown[] }) =>
      1 + (guest.hasPlusOne ? 1 : 0) + (
        Array.isArray(guest.kids)
          ? guest.kids.filter(kid => typeof kid === 'object' && kid !== null && 'name' in kid && String(kid.name).trim()).length
          : 0
      );
    const countGuestsByRsvp = (rsvp: 'confirmed' | 'pending' | 'declined') =>
      guests
        .filter(guest => guest.rsvp === rsvp)
        .reduce((sum, guest) => sum + guestPartySize(guest), 0);
    const confirmed = countGuestsByRsvp('confirmed');
    const pending = countGuestsByRsvp('pending');
    const declined = countGuestsByRsvp('declined');
    const totalBeds = houses.reduce((sum, house) =>
      sum + house.rooms.reduce((roomSum, room) => roomSum + room.beds * (room.bedType === 'double' ? 2 : 1), 0), 0);
    const occupiedBeds = houses.reduce((sum, house) =>
      sum + house.rooms.reduce((roomSum, room) => roomSum + room.guestIds.length, 0), 0);
    const totalSeats = tables.reduce((sum, table) => sum + table.seats, 0);
    const seated = tables.reduce((sum, table) => sum + table.assignments.length, 0);
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
    const committedVendorStatuses = new Set(['reserve', 'acompte-paye', 'solde-paye']);
    const reservedVendors = vendors.filter(vendor => committedVendorStatuses.has(vendor.status)).length;
    const vendorTotalCommitted = vendors
      .filter(vendor => vendor.status !== 'ecarte')
      .reduce((sum, vendor) => sum + (vendor.priceFinal || vendor.priceEstimate || 0), 0);

    const weddingDate = this.configService.get<string>('WEDDING_DATE', '2027-07-16');

    return {
      guests: {
        total: guests.reduce((sum, guest) => sum + guestPartySize(guest), 0),
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
      vendors: {
        count: vendors.length,
        reserved: reservedVendors,
        totalCommitted: vendorTotalCommitted,
      },
      daysRemaining: Math.ceil((new Date(weddingDate).getTime() - Date.now()) / 86_400_000),
    };
  }
}
