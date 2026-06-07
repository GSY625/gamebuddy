import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PartiesModule } from '../parties/parties.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DirectMessagesModule } from '../direct-messages/direct-messages.module';
import { RestrictionsModule } from '../restrictions/restrictions.module';

@Module({
  imports: [
    forwardRef(() => PartiesModule),
    forwardRef(() => NotificationsModule),
    DirectMessagesModule,
    RestrictionsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatGateway, ChatService],
})
export class ChatModule {}
