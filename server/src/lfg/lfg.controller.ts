import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LfgService } from './lfg.service';
import {
  ApplyLfgDto,
  CreateLfgPostDto,
  ResolveLfgAppDto,
  UpdateLfgPostDto,
} from './lfg.dto';
import { HttpRateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimit } from '../rate-limit/rate-limit.decorator';

@Controller('lfg-posts')
@UseGuards(JwtAuthGuard)
export class LfgController {
  constructor(private lfg: LfgService) {}

  @Post()
  @UseGuards(HttpRateLimitGuard)
  @RateLimit({
    bucket: 'lfg-create',
    limit: 6,
    windowSeconds: 600,
    keyBy: 'user-or-ip',
    message: '发布招募过于频繁，请稍后再试',
  })
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateLfgPostDto) {
    return this.lfg.create(req.user.id, dto);
  }

  @Get('my-applications')
  myApplications(@Req() req: { user: { id: string } }) {
    return this.lfg.myApplications(req.user.id);
  }

  @Get()
  list(@Query('gameId') gameId?: string, @Query('status') status?: string) {
    return this.lfg.list(gameId, status);
  }

  @Patch(':id')
  update(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateLfgPostDto,
  ) {
    return this.lfg.update(id, req.user.id, dto);
  }

  @Post(':id/apply')
  @UseGuards(HttpRateLimitGuard)
  @RateLimit({
    bucket: 'lfg-apply',
    limit: 15,
    windowSeconds: 300,
    keyBy: 'user-or-ip',
    message: '申请组队过于频繁，请稍后再试',
  })
  apply(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: ApplyLfgDto,
  ) {
    return this.lfg.apply(id, req.user.id, dto);
  }

  @Get(':id/applications')
  applications(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.lfg.getApplications(id, req.user.id);
  }

  @Patch(':postId/applications/:appId')
  resolve(
    @Req() req: { user: { id: string } },
    @Param('postId') postId: string,
    @Param('appId') appId: string,
    @Body() dto: ResolveLfgAppDto,
  ) {
    return this.lfg.resolveApplication(
      postId,
      appId,
      req.user.id,
      dto.accept,
      dto.blockApplicant,
    );
  }

  @Delete(':id')
  remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.lfg.delete(id, req.user.id);
  }
}
