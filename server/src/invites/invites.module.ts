import { Module, forwardRef } from '@nestjs/common';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { PartiesModule } from '../parties/parties.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => PartiesModule), NotificationsModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
