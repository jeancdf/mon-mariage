import { Injectable } from '@nestjs/common';
import { EventConfigService } from '../event-config/event-config.service';
import { EventKey } from '../guests/guest.entity';
import { GuestsService, PublicRsvpInput } from '../guests/guests.service';
import {
  PUBLIC_EVENT_LABELS,
  PublicRsvpHousehold,
  PublicSiteInfo,
  toPublicHousehold,
} from './public.types';

@Injectable()
export class PublicService {
  constructor(
    private readonly eventConfig: EventConfigService,
    private readonly guestsService: GuestsService,
  ) {}

  getSite(): PublicSiteInfo {
    const config = this.eventConfig.getConfiguration();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const wedding = new Date(`${config.weddingDate}T00:00:00`);
    return {
      coupleNames: config.coupleNames,
      weddingDate: config.weddingDate,
      weddingPlace: config.weddingPlace,
      timeZone: config.timeZone,
      daysRemaining: Math.max(0, Math.round((wedding.getTime() - today.getTime()) / 86_400_000)),
      events: (Object.keys(PUBLIC_EVENT_LABELS) as EventKey[]).map(key => ({
        key,
        label: PUBLIC_EVENT_LABELS[key],
      })),
    };
  }

  async getHousehold(token: string): Promise<PublicRsvpHousehold> {
    const guest = await this.guestsService.findByInviteToken(token);
    return toPublicHousehold(guest);
  }

  async submitRsvp(token: string, input: PublicRsvpInput): Promise<PublicRsvpHousehold> {
    const guest = await this.guestsService.applyPublicRsvp(token, input);
    return toPublicHousehold(guest);
  }
}
