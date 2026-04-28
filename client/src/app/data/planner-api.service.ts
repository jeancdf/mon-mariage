import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PlannerState } from './types';

@Injectable({ providedIn: 'root' })
export class PlannerApiService {
  private readonly http = inject(HttpClient);

  async loadPlanner(): Promise<PlannerState | null> {
    return firstValueFrom(this.http.get<PlannerState | null>('/api/planner'));
  }

  async savePlanner(state: PlannerState): Promise<PlannerState> {
    return firstValueFrom(this.http.put<PlannerState>('/api/planner', state));
  }
}
