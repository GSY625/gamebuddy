import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from './admin.service';
import {
  ReviewReportDto,
  SetUserBanDto,
  SetUserRestrictionDto,
} from './admin.dto';

type AdminRequest = {
  user: { id: string; role: string; nickname: string };
};

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.getOverview();
  }

  @Get('reports')
  listReports(@Query('status') status?: string) {
    return this.admin.listReports(status);
  }

  @Get('reports/:id')
  getReport(@Param('id') id: string) {
    return this.admin.getReport(id);
  }

  @Patch('reports/:id/review')
  reviewReport(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: ReviewReportDto,
  ) {
    return this.admin.reviewReport(req.user, id, dto);
  }

  @Get('users')
  listUsers(@Query('q') q?: string, @Query('banned') banned?: string) {
    return this.admin.listUsers(q, banned);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.admin.getUserDetail(id);
  }

  @Patch('users/:id/ban')
  setUserBan(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: SetUserBanDto,
  ) {
    return this.admin.setUserBan(req.user, id, dto);
  }

  @Patch('users/:id/restrictions')
  setUserRestriction(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: SetUserRestrictionDto,
  ) {
    return this.admin.setUserRestriction(req.user, id, dto);
  }

  @Get('action-logs')
  actionLogs(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.admin.listActionLogs(Number.isFinite(parsed) ? parsed : 50);
  }
}
