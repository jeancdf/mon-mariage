import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatingController } from './seating.controller';
import { SeatingService } from './seating.service';
import { SeatingTableEntity } from './seating-table.entity';
import { TableGuestEntity } from './table-guest.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SeatingTableEntity, TableGuestEntity])],
  controllers: [SeatingController],
  providers: [SeatingService],
  exports: [SeatingService],
})
export class SeatingModule {}
