import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
  finalWeeks: {
    currentlyPresent: number;
    todayMeals: { breakfast: number; lunch: number; dinner: number };
    unfinished: number;
    unassigned: number;
    overdue: number;
    completion: number;
  };
}

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);

  async loadSummary(): Promise<DashboardSummary> {
    return firstValueFrom(this.http.get<DashboardSummary>('/api/dashboard'));
  }
}
