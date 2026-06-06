import { Module, forwardRef } from '@nestjs/common';
import { PartiesController, RoomsMetaController } from './parties.controller';
import { PartiesService } from './parties.service';
import { ChatModule } from '../chat/chat.module';
import { VisibilityModule } from '../visibility/visibility.module';

@Module({
  imports: [forwardRef(() => ChatModule), VisibilityModule],
  controllers: [PartiesController, RoomsMetaController],
  providers: [PartiesService],
  exports: [PartiesService],
})
export class PartiesModule {}
