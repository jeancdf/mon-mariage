import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BudgetModule } from './budget/budget.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GuestsModule } from './guests/guests.module';
import { HousingModule } from './housing/housing.module';
import { PlannerModule } from './planner/planner.module';
import { SeatingModule } from './seating/seating.module';
import { TodosModule } from './todos/todos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '5432')),
        username: config.get<string>('DB_USER', 'mon_mariage'),
        password: config.get<string>('DB_PASSWORD', 'mon_mariage'),
        database: config.get<string>('DB_NAME', 'mon_mariage'),
        autoLoadEntities: true,
        synchronize: config.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
        ssl: config.get<string>('DB_SSL', 'false') === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),
    GuestsModule,
    HousingModule,
    SeatingModule,
    BudgetModule,
    TodosModule,
    DashboardModule,
    PlannerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
