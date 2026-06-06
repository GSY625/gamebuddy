import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  name!: string;

  @IsObject()
  fieldValues!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  publishToSquare?: boolean;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  name?: string;

  @IsOptional()
  @IsObject()
  fieldValues?: Record<string, unknown>;
}
