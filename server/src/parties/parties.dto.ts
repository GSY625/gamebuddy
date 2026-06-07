import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePartyDto {
  @IsOptional()
  @IsString()
  gameId?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class UpdatePartyMemberLimitDto {
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(99)
  maxMembers?: number | null;
}
