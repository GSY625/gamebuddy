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
import { PartiesService } from './parties.service';
import {
  CreatePartyDto,
  UpdatePartyMemberLimitDto,
} from './parties.dto';

@Controller('parties')
@UseGuards(JwtAuthGuard)
export class PartiesController {
  constructor(private parties: PartiesService) {}

  @Post()
  create(
    @Req() req: { user: { id: string } },
    @Body() dto: CreatePartyDto,
  ) {
    return this.parties.createSolo(req.user.id, dto.gameId, dto.name);
  }

  @Get()
  list(@Req() req: { user: { id: string } }) {
    return this.parties.listForUser(req.user.id);
  }

  @Get(':id')
  getOne(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.parties.getOne(id, req.user.id);
  }

  @Patch(':id/room-name')
  roomName(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    return this.parties.updateRoomName(id, req.user.id, name);
  }

  @Patch(':id/voice-hint')
  voiceHint(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body('voiceHint') voiceHint: string,
  ) {
    return this.parties.updateVoiceHint(id, req.user.id, voiceHint);
  }

  @Patch(':id/member-limit')
  memberLimit(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdatePartyMemberLimitDto,
  ) {
    return this.parties.updateMemberLimit(
      id,
      req.user.id,
      dto.maxMembers ?? null,
    );
  }

  @Post(':id/leave')
  leave(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.parties.leaveParty(id, req.user.id);
  }

  @Post(':id/dissolve')
  dissolve(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.parties.dissolveParty(id, req.user.id);
  }
}

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsMetaController {
  constructor(private parties: PartiesService) {}

  @Get(':roomId/meta')
  meta(
    @Req() req: { user: { id: string } },
    @Param('roomId') roomId: string,
  ) {
    return this.parties.getByRoomId(roomId, req.user.id);
  }
}
