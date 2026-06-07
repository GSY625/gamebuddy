import { Module, forwardRef } from '@nestjs/common';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { PartiesModule } from '../parties/parties.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RestrictionsModule } from '../restrictions/restrictions.module';

@Module({
  imports: [forwardRef(() => PartiesModule), NotificationsModule, RestrictionsModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
