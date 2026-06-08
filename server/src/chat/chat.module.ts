import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PartiesModule } from '../parties/parties.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DirectMessagesModule } from '../direct-messages/direct-messages.module';
import { RestrictionsModule } from '../restrictions/restrictions.module';
import { AuthModule } from '../auth/auth.module';
import { getJwtSecret } from '../common/runtime-env';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => PartiesModule),
    forwardRef(() => NotificationsModule),
    DirectMessagesModule,
    RestrictionsModule,
    AuthModule,
    JwtModule.register({
      secret: getJwtSecret(),
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatGateway, ChatService],
})
export class ChatModule {}
