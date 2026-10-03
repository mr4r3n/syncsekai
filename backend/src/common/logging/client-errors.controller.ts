import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { recordActivity } from './activity-log';

export class ClientErrorDto {
  @IsString() @MaxLength(200)
  path: string;

  @IsString() @MaxLength(300)
  message: string;

  /** First line of the stack, enough to find the component. */
  @IsOptional() @IsString() @MaxLength(300)
  where?: string;
}

/**
 * Errors the site hits in the visitor's browser. The error page used to keep them in
 * the browser console, so a page broken on phones went unnoticed for a day. They go
 * to the in-memory admin console, with the page and browser only: no IP, no account.
 */
@Controller('api/client-errors')
export class ClientErrorsController {
  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async report(@Body() dto: ClientErrorDto, @Req() req: Request) {
    const browser = String(req.headers['user-agent'] || 'unknown browser').slice(0, 120);
    await recordActivity({
      data: {
        level: 'ERROR',
        service: 'CLIENT_ERROR',
        message: `${dto.path}: ${dto.message}${dto.where ? ` (${dto.where})` : ''} · ${browser}`,
      },
    });
  }
}
