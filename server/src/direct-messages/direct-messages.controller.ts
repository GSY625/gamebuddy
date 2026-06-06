import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DirectMessagesService } from './direct-messages.service';

@Controller('direct-messages')
@UseGuards(JwtAuthGuard)
export class DirectMessagesController {
  constructor(private directMessages: DirectMessagesService) {}

  @Get()
  list(@Req() req: { user: { id: string } }) {
    return this.directMessages.listConversations(req.user.id);
  }

  @Get('with/:friendId')
  getConversation(
    @Req() req: { user: { id: string } },
    @Param('friendId') friendId: string,
  ) {
    return this.directMessages.getConversation(req.user.id, friendId);
  }

  @Get('with/:friendId/messages')
  messages(
    @Req() req: { user: { id: string } },
    @Param('friendId') friendId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.directMessages.getMessages(req.user.id, friendId, cursor);
  }

  @Post('with/:friendId/read')
  markRead(
    @Req() req: { user: { id: string } },
    @Param('friendId') friendId: string,
  ) {
    return this.directMessages.markConversationRead(req.user.id, friendId);
  }
}
