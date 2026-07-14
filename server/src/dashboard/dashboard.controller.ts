import { Controller, Get } from '@nestjs/common';
import { DashboardService, DashboardSummary } from './dashboard.service';
import { RequirePermission } from '../auth/auth.decorators';

@Controller('dashboard')
@RequirePermission('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getSummary(): Promise<DashboardSummary> {
    return this.dashboardService.getSummary();
  }
}
