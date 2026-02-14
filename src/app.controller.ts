import { Controller, Get, Req } from '@nestjs/common';
import { User } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public, Roles } from './common/decorator/rolesDecorator';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('me')
  @ApiBearerAuth()
  me(@Req() req: { user?: User }) {
    return req.user ?? null;
  }

  @Roles('ADMIN')
  @Get('admin')
  @ApiBearerAuth()
  admin() {
    return { ok: true };
  }
}
