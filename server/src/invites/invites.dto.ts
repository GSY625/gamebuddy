import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInviteDto {
  @IsUUID()
  receiverId!: string;

  @IsOptional()
  @IsString()
  gameId?: string;

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
