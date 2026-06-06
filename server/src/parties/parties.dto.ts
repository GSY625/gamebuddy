import { IsOptional, IsString } from 'class-validator';

export class CreatePartyDto {
  @IsOptional()
  @IsString()
  gameId?: string;

  @IsOptional()
  @IsString()
  name?: string;
}
