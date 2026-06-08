import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(@Req() req: { user: { id: string } }) {
    return this.notifications.list(req.user.id);
  }

  @Get('unread-count')
  unreadCount(@Req() req: { user: { id: string } }) {
    return this.notifications.unreadCount(req.user.id).then((count) => ({ count }));
  }

  @Patch('read-all')
  markAllRead(@Req() req: { user: { id: string } }) {
    return this.notifications.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  markRead(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(req.user.id, id);
  }

  @Delete(':id')
  remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.notifications.remove(req.user.id, id);
  }

  @Delete()
  removeAll(@Req() req: { user: { id: string } }) {
    return this.notifications.removeAll(req.user.id);
  }
}
