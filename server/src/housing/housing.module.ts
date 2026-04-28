import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HouseEntity } from './house.entity';
import { HousingController } from './housing.controller';
import { HousingService } from './housing.service';
import { RoomGuestEntity } from './room-guest.entity';
import { RoomEntity } from './room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HouseEntity, RoomEntity, RoomGuestEntity])],
  controllers: [HousingController],
  providers: [HousingService],
  exports: [HousingService],
})
export class HousingModule {}
