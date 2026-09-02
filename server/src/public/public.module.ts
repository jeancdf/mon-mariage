import { Module } from '@nestjs/common';
import { EventConfigModule } from '../event-config/event-config.module';
import { GuestsModule } from '../guests/guests.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [EventConfigModule, GuestsModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
