import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from '../auth/entities/account.entity';
import { EventConfigModule } from '../event-config/event-config.module';
import { GuestEntity } from '../guests/guest.entity';
import { RoomGuestEntity } from '../housing/room-guest.entity';
import { MealCookEntity } from './entities/meal-cook.entity';
import { MealPlanEntity } from './entities/meal-plan.entity';
import { OperationalTaskEntity } from './entities/operational-task.entity';
import { PresenceEntity } from './entities/presence.entity';
import { TaskAssigneeEntity } from './entities/task-assignee.entity';
import { FinalWeeksController } from './final-weeks.controller';
import { FinalWeeksService } from './final-weeks.service';

@Module({
  imports: [
    EventConfigModule,
    TypeOrmModule.forFeature([
      PresenceEntity,
      MealPlanEntity,
      MealCookEntity,
      OperationalTaskEntity,
      TaskAssigneeEntity,
      GuestEntity,
      AccountEntity,
      RoomGuestEntity,
    ]),
  ],
  controllers: [FinalWeeksController],
  providers: [FinalWeeksService],
  exports: [FinalWeeksService],
})
export class FinalWeeksModule {}

