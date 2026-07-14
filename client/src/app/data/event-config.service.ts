import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface EventConfiguration {
  weddingDate: string;
  weddingPlace: string;
  preparationStart: string;
  dailyStart: string;
}

@Injectable({ providedIn: 'root' })
export class EventConfigService {
  private readonly http = inject(HttpClient);
  private loading: Promise<EventConfiguration> | null = null;
  readonly configuration = signal<EventConfiguration | null>(null);

  load(): Promise<EventConfiguration> {
    if (this.configuration()) return Promise.resolve(this.configuration()!);
    if (!this.loading) {
      this.loading = firstValueFrom(this.http.get<EventConfiguration>('/api/event-config'))
        .then(config => {
          this.configuration.set(config);
          return config;
        })
        .finally(() => { this.loading = null; });
    }
    return this.loading;
  }

  dateLabel(): string {
    const date = this.configuration()?.weddingDate;
    return date ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      .format(new Date(`${date}T12:00:00`)) : '';
  }
}

