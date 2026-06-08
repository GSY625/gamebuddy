import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService } from './search.service';
import { HttpRateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimit } from '../rate-limit/rate-limit.decorator';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private search: SearchService) {}

  @Get('users')
  @UseGuards(HttpRateLimitGuard)
  @RateLimit({
    bucket: 'search-users',
    limit: 30,
    windowSeconds: 30,
    keyBy: 'user-or-ip',
    message: '搜索用户过于频繁，请稍后再试',
  })
  users(@Req() req: { user: { id: string } }, @Query('q') q: string) {
    return this.search.searchUsers(req.user.id, q ?? '');
  }

  @Get('rooms')
  @UseGuards(HttpRateLimitGuard)
  @RateLimit({
    bucket: 'search-rooms',
    limit: 30,
    windowSeconds: 30,
    keyBy: 'user-or-ip',
    message: '搜索聊天室过于频繁，请稍后再试',
  })
  rooms(@Query('code') code: string) {
    return this.search.searchRoomByCode(code ?? '');
  }
}
