import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewReportDto {
  @IsIn(['resolved', 'rejected'])
  reviewStatus!: 'resolved' | 'rejected';

  @IsOptional()
  @IsIn(['none', 'ban', 'hide_lfg'])
  actionTaken?: 'none' | 'ban' | 'hide_lfg';

  @IsOptional()
  @IsString()
  reviewNote?: string;
}

export class SetUserBanDto {
  @IsBoolean()
  banned!: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class SetUserRestrictionDto {
  @IsIn(['invite', 'direct_message', 'lfg', 'chat'])
  type!: 'invite' | 'direct_message' | 'lfg' | 'chat';

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
