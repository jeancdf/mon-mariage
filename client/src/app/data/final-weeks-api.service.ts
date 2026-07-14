import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type MealKind = 'breakfast' | 'lunch' | 'dinner';
export type TaskCategory = 'groceries' | 'errands' | 'cooking' | 'cleaning' | 'wedding' | 'other';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface FinalWeeksPerson {
  id: string;
  guestId: string;
  firstName: string;
  lastName: string;
  primary: boolean;
  organizationRole: string;
  arrivalAt: string | null;
  departureAt: string | null;
  mealSelections: Record<string, MealKind[]>;
  account: { id: string; status: string } | null;
  room: { id: string; name: string; houseName: string } | null;
}

export interface FinalWeeksMeal {
  id?: string;
  date: string;
  kind: MealKind;
  menu: string;
  notes: string;
  cookIds: string[];
  headcount: number;
}

export interface FinalWeeksTask {
  id: string;
  title: string;
  notes: string;
  category: TaskCategory;
  scheduledAt: string;
  status: TaskStatus;
  recurrenceGroupId: string | null;
  assigneeIds: string[];
}

export interface FinalWeeksHub {
  config: {
    weddingDate: string;
    weddingPlace: string;
    preparationStart: string;
    dailyStart: string;
    today: string;
    phase: 'before' | 'weekly' | 'daily' | 'complete';
  };
  summary: {
    currentlyPresent: number;
    todayMeals: Record<MealKind, number>;
    unfinished: number;
    unassigned: number;
    overdue: number;
    completion: number;
  };
  people: FinalWeeksPerson[];
  meals: FinalWeeksMeal[];
  tasks: FinalWeeksTask[];
  accounts: Array<{ id: string; guestId: string | null; name: string; status: string }>;
}

export interface TaskPayload {
  title?: string;
  notes?: string;
  category?: TaskCategory;
  scheduledAt?: string;
  status?: TaskStatus;
  assigneeIds?: string[];
  recurrence?: { type: 'none' | 'daily' | 'weekdays'; weekdays?: number[]; untilDate?: string };
}

@Injectable({ providedIn: 'root' })
export class FinalWeeksApiService {
  private readonly http = inject(HttpClient);

  load(): Promise<FinalWeeksHub> {
    return firstValueFrom(this.http.get<FinalWeeksHub>('/api/final-weeks'));
  }

  async savePresence(person: FinalWeeksPerson): Promise<void> {
    await firstValueFrom(this.http.put(`/api/final-weeks/people/${encodeURIComponent(person.id)}`, {
      arrivalAt: person.arrivalAt,
      departureAt: person.departureAt,
      mealSelections: person.mealSelections,
    }));
  }

  async saveMeal(meal: FinalWeeksMeal): Promise<void> {
    await firstValueFrom(this.http.put(`/api/final-weeks/meals/${meal.date}/${meal.kind}`, {
      menu: meal.menu,
      notes: meal.notes,
      cookIds: meal.cookIds,
    }));
  }

  async createTask(payload: TaskPayload): Promise<void> {
    await firstValueFrom(this.http.post('/api/final-weeks/tasks', payload));
  }

  async updateTask(taskId: string, payload: TaskPayload): Promise<void> {
    await firstValueFrom(this.http.patch(`/api/final-weeks/tasks/${taskId}`, payload));
  }

  async deleteTask(taskId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/final-weeks/tasks/${taskId}`));
  }
}

