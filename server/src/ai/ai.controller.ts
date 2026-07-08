import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateChatIcebreakerDto,
  CreateLfgDraftDto,
  MatchRecommendationFeedbackDto,
  ModerationSuggestDto,
  RecommendMatchDto,
} from './ai.dto';
import { AiService } from './ai.service';

type AuthedRequest = {
  user: { id: string };
};

@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Get('health')
  health() {
    return this.ai.getHealth();
  }

  @Post('lfg/draft')
  @UseGuards(JwtAuthGuard)
  createLfgDraft(
    @Req() req: AuthedRequest,
    @Body() dto: CreateLfgDraftDto,
  ) {
    return this.ai.createLfgDraft(req.user.id, dto);
  }

  @Post('match/recommend')
  @UseGuards(JwtAuthGuard)
  recommendMatch(
    @Req() req: AuthedRequest,
    @Body() dto: RecommendMatchDto,
  ) {
    return this.ai.recommendMatch(req.user.id, dto);
  }

  @Post('match/feedback')
  @UseGuards(JwtAuthGuard)
  matchFeedback(
    @Req() req: AuthedRequest,
    @Body() dto: MatchRecommendationFeedbackDto,
  ) {
    return this.ai.recordMatchFeedback(req.user.id, dto);
  }

  @Post('chat/icebreaker')
  @UseGuards(JwtAuthGuard)
  createChatIcebreaker(
    @Req() req: AuthedRequest,
    @Body() dto: CreateChatIcebreakerDto,
  ) {
    return this.ai.createChatIcebreaker(req.user.id, dto);
  }
  @Post('moderation/suggest')
  @UseGuards(JwtAuthGuard, AdminGuard)
  suggestModeration(
    @Req() req: AuthedRequest,
    @Body() dto: ModerationSuggestDto,
  ) {
    return this.ai.suggestModeration(req.user.id, dto);
  }
}