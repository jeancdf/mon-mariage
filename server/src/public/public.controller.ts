import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Public } from '../auth/auth.decorators';
import { PublicRsvpInput } from '../guests/guests.service';
import { PublicService } from './public.service';
import { PublicRsvpHousehold, PublicSiteInfo } from './public.types';

@Controller('public')
@Public()
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('site')
  getSite(): PublicSiteInfo {
    return this.publicService.getSite();
  }

  @Get('rsvp/:token')
  getHousehold(@Param('token') token: string): Promise<PublicRsvpHousehold> {
    return this.publicService.getHousehold(token);
  }

  @Put('rsvp/:token')
  submitRsvp(
    @Param('token') token: string,
    @Body() body: PublicRsvpInput,
  ): Promise<PublicRsvpHousehold> {
    return this.publicService.submitRsvp(token, body);
  }
}
