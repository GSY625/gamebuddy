import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SafetyService } from './safety.service';
import { BlockDto, ReportDto } from './safety.dto';

@Controller('safety')
@UseGuards(JwtAuthGuard)
export class SafetyController {
  constructor(private safety: SafetyService) {}

  @Post('reports')
  report(@Req() req: { user: { id: string } }, @Body() dto: ReportDto) {
    return this.safety.report(req.user.id, dto);
  }

  @Post('blocks')
  block(@Req() req: { user: { id: string } }, @Body() dto: BlockDto) {
    return this.safety.block(req.user.id, dto);
  }

  @Get('blocks')
  listBlocks(@Req() req: { user: { id: string } }) {
    return this.safety.listBlocks(req.user.id);
  }

  @Delete('blocks/:blockedId')
  unblock(
    @Req() req: { user: { id: string } },
    @Param('blockedId') blockedId: string,
  ) {
    return this.safety.unblock(req.user.id, blockedId);
  }
}
