import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AccountsService } from './accounts.service';
import { Public } from './auth.decorators';
import type { AuthenticatedRequest } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly accountsService: AccountsService) {}

  @Public()
  @Post('claim')
  async claim(
    @Body() body: { email?: string; eventCode?: string; password?: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Record<string, unknown>> {
    const account = await this.accountsService.claim(body.email, body.eventCode, body.password ?? '');
    const { csrfToken } = await this.accountsService.createSession(account, response, request.headers['user-agent'] ?? '');
    const hydrated = await this.accountsService.loadAccountForResponse(account.id);
    return { account: this.accountsService.serializeAccount(hydrated), csrfToken };
  }

  @Public()
  @Post('login')
  async login(
    @Body() body: { email?: string; password?: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Record<string, unknown>> {
    const account = await this.accountsService.login(body.email, body.password ?? '', request.ip ?? '');
    const { csrfToken } = await this.accountsService.createSession(account, response, request.headers['user-agent'] ?? '');
    const hydrated = await this.accountsService.loadAccountForResponse(account.id);
    return { account: this.accountsService.serializeAccount(hydrated), csrfToken };
  }

  @Public()
  @Get('setup')
  setupStatus(): { configured: boolean } {
    return { configured: true };
  }

  @Get('me')
  async me(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const csrfToken = await this.accountsService.rotateCsrfToken(request.session);
    return { account: this.accountsService.serializeAccount(request.account), csrfToken };
  }

  @Post('logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    await this.accountsService.logout(request.session, response);
    return { success: true };
  }

  @Post('password')
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() body: { currentPassword?: string; newPassword?: string },
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    await this.accountsService.changePassword(request.account.id, body.currentPassword ?? '', body.newPassword ?? '');
    this.accountsService.clearCookie(response);
    return { success: true };
  }
}

