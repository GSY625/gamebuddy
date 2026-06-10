export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'image'
  | 'number';

export interface FieldShowWhen {
  field: string;
  oneOf?: string[];
}

export interface GameFieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  maxImages?: number;
  placeholder?: string;
  showWhen?: FieldShowWhen;
}

export interface GameFieldSchema {
  version: number;
  fields: GameFieldDefinition[];
}

export type GamePlatform = 'pc' | 'mobile';
export type GamePlatformValue = GamePlatform | 'both';

export const RANK_NONE_OPTION = '未定级';
export const GAME_SERVER_REGION_FIELD = 'game_server_region';

export function withRankNoneOption(options: readonly string[]): string[] {
  return [RANK_NONE_OPTION, ...options];
}
