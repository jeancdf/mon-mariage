import { Controller, Get, Req } from '@nestjs/common';
import { DashboardService, DashboardSummary } from './dashboard.service';
import { RequirePermission } from '../auth/auth.decorators';
import type { AuthenticatedRequest } from '../auth/auth.types';

@Controller('dashboard')
@RequirePermission('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getSummary(@Req() request: AuthenticatedRequest): Promise<DashboardSummary> {
    return this.dashboardService.getSummary(request.account);
  }
}
