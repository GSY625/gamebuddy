import { Module } from '@nestjs/common';
import { PartiesModule } from '../parties/parties.module';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';

@Module({
  imports: [PartiesModule],
  controllers: [SafetyController],
  providers: [SafetyService],
})
export class SafetyModule {}
