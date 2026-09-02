import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const addDays = (date: string, amount: number): string => {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
};

export interface EventConfiguration {
  weddingDate: string;
  weddingPlace: string;
  preparationStart: string;
  dailyStart: string;
  timeZone: string;
  coupleNames: string[];
}

@Injectable()
export class EventConfigService {
  constructor(private readonly config: ConfigService) {}

  getConfiguration(): EventConfiguration {
    const weddingDate = this.config.get<string>('WEDDING_DATE', '2027-07-16');
    return {
      weddingDate,
      weddingPlace: this.config.get<string>('WEDDING_PLACE', 'Escayrac'),
      preparationStart: addDays(weddingDate, -56),
      dailyStart: addDays(weddingDate, -7),
      timeZone: this.getTimeZone(),
      coupleNames: this.getCoupleNames(),
    };
  }

  getTimeZone(): string {
    return this.config.get<string>('TIMEZONE', 'Europe/Paris');
  }

  getCoupleNames(): string[] {
    return [
      this.config.get<string>('COUPLE_NAME_1', ''),
      this.config.get<string>('COUPLE_NAME_2', ''),
    ].map(name => name.trim()).filter(Boolean);
  }
}
