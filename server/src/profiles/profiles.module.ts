import { Module } from '@nestjs/common';
import {
  ProfilesController,
  ProfileSearchController,
} from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  controllers: [ProfilesController, ProfileSearchController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
