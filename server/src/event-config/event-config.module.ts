import { Module } from '@nestjs/common';
import { EventConfigController } from './event-config.controller';
import { EventConfigService } from './event-config.service';

@Module({
  controllers: [EventConfigController],
  providers: [EventConfigService],
  exports: [EventConfigService],
})
export class EventConfigModule {}

