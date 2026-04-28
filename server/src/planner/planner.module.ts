import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlannerController } from './planner.controller';
import { PlannerStateEntity } from './planner-state.entity';
import { PlannerService } from './planner.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlannerStateEntity])],
  controllers: [PlannerController],
  providers: [PlannerService],
})
export class PlannerModule {}
