import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest, AccessProfileKey, SectionKey } from './auth.types';
import { AccountsService } from './accounts.service';
import { OrganizerOnly } from './auth.decorators';

@Controller('admin')
@OrganizerOnly()
export class AdminController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('accounts')
  listAccounts(@Req() request: AuthenticatedRequest): Promise<Array<Record<string, unknown>>> {
    return this.accountsService.listAccounts();
  }

  @Post('accounts/guests/:guestId')
  async enableGuest(@Req() request: AuthenticatedRequest, @Param('guestId') guestId: string): Promise<{ success: true }> {
    await this.accountsService.enableGuestAccount(guestId);
    return { success: true };
  }

  @Patch('accounts/:accountId/status')
  async setStatus(
    @Req() request: AuthenticatedRequest,
    @Param('accountId') accountId: string,
    @Body() body: { status: 'pending' | 'active' | 'disabled' },
  ): Promise<{ success: true }> {
    await this.accountsService.setAccountStatus(accountId, body.status);
    return { success: true };
  }

  @Post('accounts/:accountId/reset')
  async reset(
    @Req() request: AuthenticatedRequest,
    @Param('accountId') accountId: string,
    @Body() body: { newPassword?: string },
  ): Promise<{ success: true }> {
    await this.accountsService.resetAccount(accountId, body.newPassword);
    return { success: true };
  }

  @Get('profiles')
  listProfiles(@Req() request: AuthenticatedRequest) {
    return this.accountsService.listProfiles();
  }

  @Patch('profiles/:profileKey')
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Param('profileKey') profileKey: AccessProfileKey,
    @Body() body: { name?: string; permissions?: Partial<Record<SectionKey, { canView: boolean; canEdit: boolean }>> },
  ) {
    return this.accountsService.updateProfile(profileKey, body);
  }
}
