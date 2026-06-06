import { Module, forwardRef } from '@nestjs/common';
import { LfgController } from './lfg.controller';
import { LfgService } from './lfg.service';
import { PartiesModule } from '../parties/parties.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => PartiesModule), NotificationsModule],
  controllers: [LfgController],
  providers: [LfgService],
})
export class LfgModule {}
