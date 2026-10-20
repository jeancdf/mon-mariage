import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestEntity } from './guest.entity';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { RoomGuestEntity } from '../housing/room-guest.entity';
import { TableGuestEntity } from '../seating/table-guest.entity';
import { AuthModule } from '../auth/auth.module';
import { PresenceEntity } from '../final-weeks/entities/presence.entity';
import { HousingStayEntity } from '../housing/housing-stay.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([GuestEntity, RoomGuestEntity, TableGuestEntity, PresenceEntity, HousingStayEntity])],
  controllers: [GuestsController],
  providers: [GuestsService],
  exports: [GuestsService],
})
export class GuestsModule {}
