import {
  IsBoolean,
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class CreateLfgPostDto {
  @IsString()
  gameId!: string;

  @IsString()
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  voiceMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  playStyle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  timeNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  genderPreference?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateLfgPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  voiceMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  playStyle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  timeNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  genderPreference?: string;
}

export class ApplyLfgDto {
  @IsOptional()
  @IsString()
  message?: string;
}

export class ResolveLfgAppDto {
  @IsBoolean()
  accept!: boolean;

  @IsOptional()
  @IsBoolean()
  blockApplicant?: boolean;
}
