import { Body, Controller, Get, Put } from '@nestjs/common';
import { GuestEntity } from './guest.entity';
import { GuestsService } from './guests.service';

interface ReplaceGuestsBody {
  guests: Array<Omit<GuestEntity, 'id'> & { id?: string }>;
}

@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get()
  findAll(): Promise<GuestEntity[]> {
    return this.guestsService.findAll();
  }

  @Put('import')
  replaceAll(@Body() body: ReplaceGuestsBody): Promise<GuestEntity[]> {
    const guests = Array.isArray(body?.guests) ? body.guests : [];
    return this.guestsService.replaceAll(guests);
  }
}
