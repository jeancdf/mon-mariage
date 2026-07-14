import { Controller, Get } from '@nestjs/common';
import { AppService, HealthResponse } from './app.service';
import { Public } from './auth/auth.decorators';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): { name: string; status: string } {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  getHealth(): HealthResponse {
    return this.appService.getHealth();
  }
}
