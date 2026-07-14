import { Body, Controller, Delete, Get, Param, Patch, Put, Req } from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { MealKind, MealSelections } from './entities/presence.entity';
import type { OperationalTaskCategory, OperationalTaskStatus } from './entities/operational-task.entity';
import { FinalWeeksService } from './final-weeks.service';
import type { RecurrenceInput } from './final-weeks.utils';

@Controller('final-weeks')
@RequirePermission('final_weeks')
export class FinalWeeksController {
  constructor(private readonly finalWeeks: FinalWeeksService) {}

  @Get()
  getHub() {
    return this.finalWeeks.getHub();
  }

  @Put('people/:guestPersonId')
  @RequirePermission('final_weeks', 'edit')
  async updatePresence(
    @Req() request: AuthenticatedRequest,
    @Param('guestPersonId') guestPersonId: string,
    @Body() body: { arrivalAt?: string | null; departureAt?: string | null; mealSelections?: MealSelections },
  ): Promise<{ success: true }> {
    await this.finalWeeks.updatePresence(request.account, guestPersonId, body);
    return { success: true };
  }

  @Put('meals/:date/:kind')
  @RequirePermission('final_weeks', 'edit')
  async saveMeal(
    @Req() request: AuthenticatedRequest,
    @Param('date') date: string,
    @Param('kind') kind: MealKind,
    @Body() body: { menu?: string; notes?: string; cookIds?: string[] },
  ): Promise<{ success: true }> {
    await this.finalWeeks.saveMeal(request.account, date, kind, body);
    return { success: true };
  }

  @Post('tasks')
  @RequirePermission('final_weeks', 'edit')
  async createTasks(
    @Req() request: AuthenticatedRequest,
    @Body() body: {
      title?: string;
      notes?: string;
      category?: OperationalTaskCategory;
      scheduledAt?: string;
      assigneeIds?: string[];
      recurrence?: RecurrenceInput;
    },
  ): Promise<{ success: true }> {
    await this.finalWeeks.createTasks(request.account, body);
    return { success: true };
  }

  @Patch('tasks/:taskId')
  @RequirePermission('final_weeks', 'edit')
  async updateTask(
    @Req() request: AuthenticatedRequest,
    @Param('taskId') taskId: string,
    @Body() body: {
      title?: string;
      notes?: string;
      category?: OperationalTaskCategory;
      scheduledAt?: string;
      status?: OperationalTaskStatus;
      assigneeIds?: string[];
    },
  ): Promise<{ success: true }> {
    await this.finalWeeks.updateTask(request.account, taskId, body);
    return { success: true };
  }

  @Delete('tasks/:taskId')
  @RequirePermission('final_weeks', 'edit')
  async deleteTask(
    @Req() request: AuthenticatedRequest,
    @Param('taskId') taskId: string,
  ): Promise<{ success: true }> {
    await this.finalWeeks.deleteTask(request.account, taskId);
    return { success: true };
  }
}

