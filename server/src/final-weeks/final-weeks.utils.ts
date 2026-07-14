import { BadRequestException } from '@nestjs/common';
import { addDays } from '../event-config/event-config.service';

export interface RecurrenceInput {
  type: 'none' | 'daily' | 'weekdays';
  weekdays?: number[];
  untilDate?: string;
}

export const isDateInWindow = (date: string, start: string, end: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= start && date <= end;

export const expandRecurrenceDates = (
  startDate: string,
  windowEnd: string,
  recurrence?: RecurrenceInput,
): string[] => {
  if (!recurrence || recurrence.type === 'none') return [startDate];
  if (recurrence.untilDate && !/^\d{4}-\d{2}-\d{2}$/.test(recurrence.untilDate)) {
    throw new BadRequestException('Date de fin de répétition invalide.');
  }
  const until = recurrence.untilDate && recurrence.untilDate < windowEnd ? recurrence.untilDate : windowEnd;
  if (until < startDate) throw new BadRequestException('La fin de répétition précède la première occurrence.');
  const weekdays = new Set((recurrence.weekdays ?? []).filter(value => Number.isInteger(value) && value >= 0 && value <= 6));
  if (recurrence.type === 'weekdays' && !weekdays.size) {
    throw new BadRequestException('Sélectionnez au moins un jour de la semaine.');
  }
  const dates: string[] = [];
  for (let date = startDate; date <= until; date = addDays(date, 1)) {
    const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    if (recurrence.type === 'daily' || weekdays.has(day)) dates.push(date);
    if (dates.length > 64) throw new BadRequestException('La répétition contient trop de dates.');
  }
  return dates;
};
