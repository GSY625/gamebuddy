import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { ChangePasswordDto, UpdateUserDto } from './users.dto';
import { SetVisibilityDto } from './users.visibility.dto';

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user: { id: string } }) {
    return this.users.getMe(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  updateMe(@Req() req: { user: { id: string } }, @Body() dto: UpdateUserDto) {
    return this.users.updateMe(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/password')
  changePassword(
    @Req() req: { user: { id: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.users.changePassword(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/visibility')
  setVisibility(
    @Req() req: { user: { id: string } },
    @Body() dto: SetVisibilityDto,
  ) {
    return this.users.setVisibility(req.user.id, dto.status);
  }

  @Get('check-nickname')
  checkNickname(
    @Query('nickname') nickname: string,
    @Query('excludeUserId') excludeUserId?: string,
  ) {
    return this.users.checkNickname(nickname ?? '', excludeUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.users.findById(id, req.user.id);
  }
}
