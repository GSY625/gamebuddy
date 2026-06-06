import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto, UpdateProfileDto } from './profiles.dto';

@Controller('users/me/game-profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private profiles: ProfilesService) {}

  @Get(':gameId/list')
  list(@Req() req: { user: { id: string } }, @Param('gameId') gameId: string) {
    return this.profiles.listMine(req.user.id, gameId);
  }

  @Post(':gameId')
  create(
    @Req() req: { user: { id: string } },
    @Param('gameId') gameId: string,
    @Body() dto: CreateProfileDto,
  ) {
    return this.profiles.create(req.user.id, gameId, dto);
  }

  @Get('schemes/:profileId')
  getOne(
    @Req() req: { user: { id: string } },
    @Param('profileId') profileId: string,
  ) {
    return this.profiles.getOne(profileId, req.user.id);
  }

  @Put('schemes/:profileId')
  update(
    @Req() req: { user: { id: string } },
    @Param('profileId') profileId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profiles.update(profileId, req.user.id, dto);
  }

  @Delete('schemes/:profileId')
  remove(
    @Req() req: { user: { id: string } },
    @Param('profileId') profileId: string,
  ) {
    return this.profiles.remove(profileId, req.user.id);
  }

  @Put('schemes/:profileId/publish')
  publish(
    @Req() req: { user: { id: string } },
    @Param('profileId') profileId: string,
  ) {
    return this.profiles.setPublished(profileId, req.user.id, true);
  }

  @Put('schemes/:profileId/unpublish')
  unpublish(
    @Req() req: { user: { id: string } },
    @Param('profileId') profileId: string,
  ) {
    return this.profiles.setPublished(profileId, req.user.id, false);
  }
}

@Controller('game-profiles')
@UseGuards(JwtAuthGuard)
export class ProfileSearchController {
  constructor(private profiles: ProfilesService) {}

  @Get()
  search(
    @Req() req: { user: { id: string } },
    @Query('gameId') gameId: string,
    @Query('rank') rank?: string,
    @Query('mode') mode?: string,
    @Query('region') region?: string,
  ) {
    return this.profiles.search(gameId, { rank, mode, region }, req.user.id);
  }
}
