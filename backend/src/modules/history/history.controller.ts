import { Controller, Get, Delete, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private historyService: HistoryService) {}

  @Get()
  async getHistory(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.historyService.getUserHistory(user.id, page, limit, search);
  }

  @Get('stats/summary')
  async getSummary(@CurrentUser() user: any) {
    return this.historyService.getStatsSummary(user.id);
  }

  @Get('stats/heatmap')
  async getHeatmap(@CurrentUser() user: any) {
    return this.historyService.getViewingHeatmap(user.id);
  }

  @Post('batch-revert')
  async batchDeleteAndRevert(
    @CurrentUser() user: any,
    @Body('ids') ids: string[],
  ) {
    return this.historyService.batchDeleteAndRevert(user.id, ids);
  }

  @Delete(':id')
  async deleteAndRevert(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.historyService.deleteAndRevert(user.id, id);
  }
}
