import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chat: ChatService) {}

  @Get(':id/messages')
  messages(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chat.getMessages(id, req.user.id, cursor);
  }

  @Post(':id/read')
  markRead(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.chat.markRoomRead(id, req.user.id);
  }

  @Get(':id/unread-count')
  unreadCount(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.chat
      .getUnreadCount(id, req.user.id)
      .then((count) => ({ count }));
  }

  @Get(':id/pending-mention')
  pendingMention(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.chat
      .findPendingMention(id, req.user.id)
      .then((messageId) => ({ messageId }));
  }
}
