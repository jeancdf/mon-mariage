import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestEntity } from '../guests/guest.entity';
import { AccountsService } from './accounts.service';
import { AdminController } from './admin.controller';
import { AuthController } from './auth.controller';
import { CsrfGuard, PermissionGuard, SessionGuard } from './auth.guards';
import { AccessProfileEntity } from './entities/access-profile.entity';
import { AccountEntity } from './entities/account.entity';
import { PermissionEntity } from './entities/permission.entity';
import { SessionEntity } from './entities/session.entity';
import { PasswordService } from './password.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    AccountEntity,
    SessionEntity,
    AccessProfileEntity,
    PermissionEntity,
    GuestEntity,
  ])],
  controllers: [AuthController, AdminController],
  providers: [
    AccountsService,
    PasswordService,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [AccountsService, TypeOrmModule],
})
export class AuthModule {}

