import { Module } from '@nestjs/common';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RestrictionsModule } from '../restrictions/restrictions.module';

@Module({
  imports: [NotificationsModule, RestrictionsModule],
  controllers: [DirectMessagesController],
  providers: [DirectMessagesService],
  exports: [DirectMessagesService],
})
export class DirectMessagesModule {}
