import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './invites.dto';
import { HttpRateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimit } from '../rate-limit/rate-limit.decorator';

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private invites: InvitesService) {}

  @Post()
  @UseGuards(HttpRateLimitGuard)
  @RateLimit({
    bucket: 'invite-create',
    limit: 12,
    windowSeconds: 60,
    keyBy: 'user-or-ip',
    message: '发送邀请过于频繁，请稍后再试',
  })
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateInviteDto) {
    return this.invites.create(req.user.id, dto);
  }

  @Get('received')
  received(@Req() req: { user: { id: string } }) {
    return this.invites.listReceived(req.user.id);
  }

  @Get('sent')
  sent(@Req() req: { user: { id: string } }) {
    return this.invites.listSent(req.user.id);
  }

  @Patch(':id')
  resolve(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body('accept') accept: boolean,
  ) {
    return this.invites.resolve(id, req.user.id, accept);
  }
}
