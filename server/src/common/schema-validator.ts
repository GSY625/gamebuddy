import {
  GameFieldDefinition,
  GameFieldSchema,
  getLolLaneOptions,
  getWzryDivisionOptions,
  isLolModeWithoutRank,
  isWzryGame,
  LOL_RANK_FIELD_KEYS,
} from '@gamebuddy/shared';

function isFieldVisible(
  field: GameFieldDefinition,
  values: Record<string, unknown>,
): boolean {
  if (!field.showWhen) return true;
  const dep = values[field.showWhen.field];
  if (dep === undefined || dep === null || dep === '') return false;
  if (field.showWhen.oneOf) {
    return field.showWhen.oneOf.includes(String(dep));
  }
  return true;
}

export function validateFieldValues(
  schema: GameFieldSchema,
  values: Record<string, unknown>,
  gameSlug?: string,
): string | null {
  const mode = String(values.game_mode ?? '');
  const hideRank = isLolModeWithoutRank(mode);

  for (const field of schema.fields) {
    if (!isFieldVisible(field, values)) continue;
    if (
      hideRank &&
      (LOL_RANK_FIELD_KEYS as readonly string[]).includes(field.key)
    ) {
      continue;
    }

    const val = values[field.key];
    if (field.required && (val === undefined || val === null || val === '')) {
      return `字段「${field.label}」为必填`;
    }
    if (val === undefined || val === null) continue;

    switch (field.type) {
      case 'select': {
        if (typeof val !== 'string') return `「${field.label}」格式错误`;
        let allowed = field.options ?? [];
        if (field.key === 'lane') {
          allowed = getLolLaneOptions(mode);
        } else if (
          field.key === 'rank_division' &&
          gameSlug &&
          isWzryGame(gameSlug)
        ) {
          allowed = getWzryDivisionOptions(String(values.rank ?? ''));
        }
        if (allowed.length > 0 && !allowed.includes(val)) {
          return `「${field.label}」选项无效`;
        }
        break;
      }
      case 'multiselect': {
        if (!Array.isArray(val)) return `「${field.label}」须为多选`;
        const allowed =
          field.key === 'lane'
            ? getLolLaneOptions(mode)
            : field.options ?? [];
        for (const item of val) {
          if (!allowed.includes(String(item))) {
            return `「${field.label}」含无效选项`;
          }
        }
        break;
      }
      case 'boolean':
        if (typeof val !== 'boolean') return `「${field.label}」须为布尔`;
        break;
      case 'number':
        if (typeof val !== 'number' && isNaN(Number(val))) {
          return `「${field.label}」须为数字`;
        }
        break;
      case 'image':
        if (!Array.isArray(val)) return `「${field.label}」须为图片列表`;
        if (field.maxImages && val.length > field.maxImages) {
          return `「${field.label}」最多 ${field.maxImages} 张`;
        }
        break;
      case 'text':
      case 'textarea':
        if (typeof val !== 'string') return `「${field.label}」须为文本`;
        break;
    }
  }
  return null;
}

export function parseGameSchema(raw: unknown): GameFieldSchema {
  const s = raw as GameFieldSchema;
  if (!s?.fields || !Array.isArray(s.fields)) {
    throw new Error('Invalid game schema');
  }
  return s;
}
