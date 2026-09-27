import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BlacklistService } from './blacklist.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/blacklist')
@UseGuards(JwtAuthGuard)
export class BlacklistController {
  constructor(private blacklistService: BlacklistService) {}

  @Get()
  async getBlacklist(@CurrentUser() user: any) {
    return this.blacklistService.getUserBlacklist(user.id);
  }

  @Get('genres')
  async getBlockedGenres(@CurrentUser() user: any) {
    return this.blacklistService.getBlockedGenres(user.id);
  }

  @Put('genres')
  async updateBlockedGenres(@CurrentUser() user: any, @Body('genres') genres: string[]) {
    return this.blacklistService.updateBlockedGenres(user.id, genres);
  }

  @Post()
  async addEntry(
    @CurrentUser() user: any,
    @Body('titlePattern') titlePattern: string,
    @Body('reason') reason?: string,
  ) {
    return this.blacklistService.addEntry(user.id, titlePattern, reason);
  }

  @Delete(':id')
  async removeEntry(@CurrentUser() user: any, @Param('id') id: string) {
    return this.blacklistService.removeEntry(user.id, id);
  }
}
