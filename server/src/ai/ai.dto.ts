import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { AiChatRole, AiModelTier } from './ai.types';

export class AiChatMessageDto {
  @IsIn(['system', 'user', 'assistant'])
  role!: AiChatRole;

  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class AiChatCompletionDto {
  @IsString()
  @MaxLength(80)
  scene!: string;

  @IsOptional()
  @IsIn(['fast', 'quality'])
  modelTier?: AiModelTier;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AiChatMessageDto)
  messages!: AiChatMessageDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4000)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  inputSummary?: string;
}

export class CreateLfgDraftDto {
  @IsString()
  gameId!: string;

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
  @IsString()
  @MaxLength(500)
  extraRequirement?: string;
}

export class RecommendMatchDto {
  @IsString()
  gameId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  rank?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  mode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}

export class MatchRecommendationFeedbackDto {
  @IsString()
  gameId!: string;

  @IsString()
  candidateUserId!: string;

  @IsIn(['suitable', 'unsuitable', 'ignored'])
  feedback!: 'suitable' | 'unsuitable' | 'ignored';
}

export class CreateChatIcebreakerDto {
  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  threadId?: string;

  @IsIn(['first_message', 'team_invite', 'after_match'])
  contextType!: 'first_message' | 'team_invite' | 'after_match';
}
export class ModerationSuggestDto {
  @IsString()
  reportId!: string;
}