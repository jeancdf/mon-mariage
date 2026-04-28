import { Component, computed, inject } from '@angular/core';
import { WeddingStore } from '../../data/store';
import { fmtCurrency } from '../../shared/wedding-utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  readonly store = inject(WeddingStore);
  readonly fmtCurrency = fmtCurrency;
  readonly daysRemaining = Math.ceil((new Date('2027-07-16').getTime() - Date.now()) / 86_400_000);

  readonly stats = computed(() => {
    const guests = this.store.guests();
    const houses = this.store.houses();
    const tables = this.store.tables();
    const budget = this.store.budget();
    const confirmed = guests.filter(g => g.rsvp === 'confirmed').length;
    const pending = guests.filter(g => g.rsvp === 'pending').length;
    const declined = guests.filter(g => g.rsvp === 'declined').length;
    const totalBeds = houses.reduce((sum, house) =>
      sum + house.rooms.reduce((roomSum, room) => roomSum + room.beds * (room.bedType === 'double' ? 2 : 1), 0), 0);
    const occupiedBeds = houses.reduce((sum, house) =>
      sum + house.rooms.reduce((roomSum, room) => roomSum + room.guestIds.length, 0), 0);
    const totalSeats = tables.reduce((sum, table) => sum + table.seats, 0);
    const seated = tables.reduce((sum, table) => sum + table.guestIds.length, 0);
    const totalEstimated = budget.categories.reduce((sum, cat) => sum + cat.estimated, 0);
    const totalSpent = budget.categories.reduce((sum, cat) =>
      sum + cat.items.reduce((itemSum, item) => itemSum + item.amount, 0), 0);

    return { guests, budget, confirmed, pending, declined, totalBeds, occupiedBeds, totalSeats, seated, totalEstimated, totalSpent };
  });

  percent(value: number, total: number): number {
    return total ? Math.round((value / total) * 100) : 0;
  }

  spentForCategory(categoryId: string): number {
    const category = this.store.budget().categories.find(cat => cat.id === categoryId);
    return category ? category.items.reduce((sum, item) => sum + item.amount, 0) : 0;
  }
}
