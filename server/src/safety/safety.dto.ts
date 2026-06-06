import { IsString, IsUUID, IsOptional } from 'class-validator';

export class ReportDto {
  @IsUUID()
  reportedId!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  detail?: string;
}

export class BlockDto {
  @IsUUID()
  blockedId!: string;
}
