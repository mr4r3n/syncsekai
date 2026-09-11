import { Controller, Get, Post, Delete, Body, Param, UseGuards, Query, ForbiddenException } from '@nestjs/common';
import { MappingsService } from './mappings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/mappings')
@UseGuards(JwtAuthGuard)
export class MappingsController {
  constructor(private mappingsService: MappingsService) {}

  @Get()
  async getMappings(@CurrentUser() user: any) {
    return this.mappingsService.getUserMappings(user.id);
  }

  @Get('admin/all')
  async getAllAdminMappings(@CurrentUser() user: any) {
    const isAdmin = user.role === 'ADMIN';
    return this.mappingsService.getAllAdminMappings(isAdmin);
  }

  @Post(':id/toggle-global')
  async toggleGlobalMapping(@CurrentUser() user: any, @Param('id') id: string) {
    const isAdmin = user.role === 'ADMIN';
    if (!isAdmin && user.settings && !user.settings.canEditMappings) {
      throw new ForbiddenException('No tienes permisos asignados para modificar el alcance de Mappings.');
    }
    return this.mappingsService.toggleGlobal(user.id, id, isAdmin);
  }

  @Post(':id/approve')
  async approveMapping(@CurrentUser() user: any, @Param('id') id: string) {
    const isAdmin = user.role === 'ADMIN';
    if (user.settings && !user.settings.canEditMappings && !isAdmin) {
      throw new ForbiddenException('No tienes permisos asignados para aprobar Mappings.');
    }
    return this.mappingsService.approveMapping(user.id, id, isAdmin);
  }

  @Post('manual')
  async setManualMapping(
    @CurrentUser() user: any,
    @Body()
    data: {
      mappingId?: string;
      plexTitle: string;
      plexSeason?: number;
      anilistMediaId: number;
      anilistTitle: string;
      malMediaId?: number;
      malTitle?: string;
      kitsuMediaId?: number;
      kitsuTitle?: string;
      isGlobal?: boolean;
    },
  ) {
    const isAdmin = user.role === 'ADMIN';
    if (user.settings && !user.settings.canEditMappings && !isAdmin) {
      throw new ForbiddenException('No tienes permisos asignados para crear o editar Mappings.');
    }
    return this.mappingsService.setManualMapping(user.id, data, isAdmin);
  }

  @Delete(':id')
  async unlinkMapping(@CurrentUser() user: any, @Param('id') id: string) {
    const isAdmin = user.role === 'ADMIN';
    if (user.settings && !user.settings.canEditMappings && !isAdmin) {
      throw new ForbiddenException('No tienes permisos asignados para desvincular o eliminar Mappings.');
    }
    return this.mappingsService.unlinkMapping(user.id, id, isAdmin);
  }

  @Get('search-remote')
  async searchRemote(@Query('q') query: string, @Query('season') season?: string) {
    const seasonNumber = season ? parseInt(season, 10) : 1;
    return this.mappingsService.searchRemoteTitles(query, isNaN(seasonNumber) ? 1 : seasonNumber);
  }

  @Post('import')
  async importMappings(@CurrentUser() user: any, @Body() body: { items: any[] }) {
    if (user.settings && !user.settings.canEditMappings && user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permisos asignados para importar Mappings.');
    }
    const isAdmin = user.role === 'ADMIN';
    return this.mappingsService.importMappings(user.id, body.items, isAdmin);
  }
}
