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

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private invites: InvitesService) {}

  @Post()
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
