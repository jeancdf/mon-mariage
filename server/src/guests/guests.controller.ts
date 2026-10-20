import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { GuestEntity } from './guest.entity';
import { GuestsService } from './guests.service';
import { RequirePermission } from '../auth/auth.decorators';

interface ReplaceGuestsBody {
  guests: Partial<GuestEntity>[];
}

export const guestResponse = (guest: GuestEntity) => {
  const { inviteToken, inviteTokenCreatedAt: _createdAt, ...fields } = guest;
  return { ...fields, hasInviteLink: Boolean(inviteToken) };
};

@Controller('guests')
@RequirePermission('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get()
  async findAll() {
    return (await this.guestsService.findAll()).map(guestResponse);
  }

  @Post()
  @RequirePermission('guests', 'edit')
  async create(@Body() guest: Omit<GuestEntity, 'id'>) {
    return guestResponse(await this.guestsService.create(guest));
  }

  @Post(':id/invite-link')
  @RequirePermission('guests', 'edit')
  async issueInviteLink(@Param('id') id: string): Promise<{ token: string; path: string }> {
    const { token } = await this.guestsService.issueInviteToken(id, false);
    return { token, path: `/i/${token}` };
  }

  @Post(':id/invite-link/regenerate')
  @RequirePermission('guests', 'edit')
  async regenerateInviteLink(@Param('id') id: string): Promise<{ token: string; path: string }> {
    const { token } = await this.guestsService.issueInviteToken(id, true);
    return { token, path: `/i/${token}` };
  }

  @Patch(':id')
  @RequirePermission('guests', 'edit')
  async update(
    @Param('id') id: string,
    @Body() guest: Partial<Omit<GuestEntity, 'id'>>,
  ) {
    return guestResponse(await this.guestsService.update(id, guest));
  }

  @Delete(':id')
  @RequirePermission('guests', 'edit')
  async delete(@Param('id') id: string): Promise<{ success: true }> {
    await this.guestsService.delete(id);
    return { success: true };
  }

  @Put('import')
  @RequirePermission('guests', 'edit')
  async importGuests(@Body() body: ReplaceGuestsBody) {
    const guests = Array.isArray(body?.guests) ? body.guests : [];
    return (await this.guestsService.importGuests(guests)).map(guestResponse);
  }
}
