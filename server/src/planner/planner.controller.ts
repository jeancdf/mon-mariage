import { Body, Controller, Get, Put } from '@nestjs/common';
import { PlannerState } from './planner-state.entity';
import { PlannerService } from './planner.service';

@Controller('planner')
export class PlannerController {
  constructor(private readonly plannerService: PlannerService) {}

  @Get()
  find(): Promise<PlannerState | null> {
    return this.plannerService.find();
  }

  @Put()
  save(@Body() state: PlannerState): Promise<PlannerState> {
    return this.plannerService.save(state);
  }
}
