import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { AiController } from './ai.controller';
import { AiLogService } from './ai-log.service';
import { AiProviderService } from './ai-provider.service';
import { AiService } from './ai.service';

@Module({
  imports: [PrismaModule, ProfilesModule, AdminModule],
  controllers: [AiController],
  providers: [AiService, AiProviderService, AiLogService],
  exports: [AiService, AiProviderService],
})
export class AiModule {}