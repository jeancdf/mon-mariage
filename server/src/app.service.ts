import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

@Injectable()
export class AppService {
  getHello(): { name: string; status: string } {
    return {
      name: 'Mon Mariage API',
      status: 'running',
    };
  }

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
