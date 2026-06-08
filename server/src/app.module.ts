import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GamesModule } from './games/games.module';
import { ProfilesModule } from './profiles/profiles.module';
import { UploadModule } from './upload/upload.module';
import { LfgModule } from './lfg/lfg.module';
import { InvitesModule } from './invites/invites.module';
import { PartiesModule } from './parties/parties.module';
import { ChatModule } from './chat/chat.module';
import { SafetyModule } from './safety/safety.module';
import { PresenceModule } from './presence/presence.module';
import { VisibilityModule } from './visibility/visibility.module';
import { FriendsModule } from './friends/friends.module';
import { SearchModule } from './search/search.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DirectMessagesModule } from './direct-messages/direct-messages.module';
import { AdminModule } from './admin/admin.module';
import { RestrictionsModule } from './restrictions/restrictions.module';
import { LoggingModule } from './logging/logging.module';
import { RequestContextMiddleware } from './logging/request-context.middleware';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggingModule,
    HealthModule,
    RateLimitModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    GamesModule,
    ProfilesModule,
    UploadModule,
    LfgModule,
    InvitesModule,
    PartiesModule,
    ChatModule,
    SafetyModule,
    PresenceModule,
    VisibilityModule,
    FriendsModule,
    SearchModule,
    NotificationsModule,
    DirectMessagesModule,
    AdminModule,
    RestrictionsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
