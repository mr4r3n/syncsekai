import { Body, Controller, ForbiddenException, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CommunityMappingService } from './community-mapping.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/community-mappings')
export class CommunityMappingController {
  constructor(private communityMappingService: CommunityMappingService) {}

  /** Public: shown on the landing page. Only users who opted in appear. */
  @Get('leaderboard')
  getLeaderboard() {
    return this.communityMappingService.getLeaderboard();
  }

  @Post('accept/:mappingId')
  @UseGuards(JwtAuthGuard)
  acceptSuggestion(@CurrentUser() user: any, @Param('mappingId') mappingId: string) {
    if (user.settings && !user.settings.canEditMappings && user.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to edit mappings.');
    }
    return this.communityMappingService.acceptSuggestion(user.id, mappingId);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard)
  getAdminOverview(@CurrentUser() user: any) {
    assertAdmin(user);
    return this.communityMappingService.getAdminOverview();
  }

  @Put('admin/config')
  @UseGuards(JwtAuthGuard)
  updateConfig(@CurrentUser() user: any, @Body() body: Record<string, unknown>) {
    assertAdmin(user);
    return this.communityMappingService.updateConfig(body);
  }

  @Post('admin/dismiss')
  @UseGuards(JwtAuthGuard)
  dismiss(@CurrentUser() user: any, @Body() body: { key: string; dismissed?: boolean }) {
    assertAdmin(user);
    return this.communityMappingService.dismiss(body?.key, body?.dismissed !== false);
  }

  @Post('admin/promote')
  @UseGuards(JwtAuthGuard)
  promote(@CurrentUser() user: any, @Body() body: { key: string }) {
    assertAdmin(user);
    return this.communityMappingService.promote(user.id, body?.key);
  }

  @Post('admin/notify')
  @UseGuards(JwtAuthGuard)
  notifyNow(@CurrentUser() user: any) {
    assertAdmin(user);
    return this.communityMappingService.notifyConflicts();
  }
}

function assertAdmin(user: any) {
  if (user?.role !== 'ADMIN') throw new ForbiddenException('Access restricted to administrators.');
}
