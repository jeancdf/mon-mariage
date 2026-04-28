import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
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

  @Post()
  create(@Body() guest: Omit<GuestEntity, 'id'>): Promise<GuestEntity> {
    return this.guestsService.create(guest);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() guest: Partial<Omit<GuestEntity, 'id'>>,
  ): Promise<GuestEntity> {
    return this.guestsService.update(id, guest);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ success: true }> {
    await this.guestsService.delete(id);
    return { success: true };
  }

  @Put('import')
  replaceAll(@Body() body: ReplaceGuestsBody): Promise<GuestEntity[]> {
    const guests = Array.isArray(body?.guests) ? body.guests : [];
    return this.guestsService.replaceAll(guests);
  }
}
