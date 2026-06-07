import { Module, forwardRef } from '@nestjs/common';
import { LfgController } from './lfg.controller';
import { LfgService } from './lfg.service';
import { PartiesModule } from '../parties/parties.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RestrictionsModule } from '../restrictions/restrictions.module';

@Module({
  imports: [forwardRef(() => PartiesModule), NotificationsModule, RestrictionsModule],
  controllers: [LfgController],
  providers: [LfgService],
})
export class LfgModule {}
