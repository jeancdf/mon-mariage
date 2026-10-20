import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HouseEntity } from './house.entity';
import { HousingController } from './housing.controller';
import { HousingService } from './housing.service';
import { RoomGuestEntity } from './room-guest.entity';
import { RoomEntity } from './room.entity';
import { GuestEntity } from '../guests/guest.entity';
import { HousingStayEntity } from './housing-stay.entity';
import { EventConfigModule } from '../event-config/event-config.module';
import { PresenceEntity } from '../final-weeks/entities/presence.entity';

@Module({
  imports: [EventConfigModule, TypeOrmModule.forFeature([HouseEntity, RoomEntity, RoomGuestEntity, GuestEntity, HousingStayEntity, PresenceEntity])],
  controllers: [HousingController],
  providers: [HousingService],
  exports: [HousingService],
})
export class HousingModule {}
