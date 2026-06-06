import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private search: SearchService) {}

  @Get('users')
  users(@Req() req: { user: { id: string } }, @Query('q') q: string) {
    return this.search.searchUsers(req.user.id, q ?? '');
  }

  @Get('rooms')
  rooms(@Query('code') code: string) {
    return this.search.searchRoomByCode(code ?? '');
  }
}
