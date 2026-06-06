import type { GameFieldDefinition, GameFieldSchema } from '@gamebuddy/shared';
import { formatGameRank, GAME_SERVER_REGION_FIELD } from '@gamebuddy/shared';
import { isFieldVisible } from '../utils/fieldVisibility';

const RANK_SUB_KEYS = new Set([
  'rank_division',
  'rank_lp',
  'rank_beans',
  'stars',
]);

function hasDisplayValue(value: unknown, type: GameFieldDefinition['type']): boolean {
  if (type === 'boolean') return value !== undefined && value !== null;
  if (type === 'image') return Array.isArray(value) && value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value === undefined || value === null || value === '') return false;
  return true;
}

type Props = {
  schema: GameFieldSchema;
  fieldValues: Record<string, unknown>;
  gameSlug: string;
  /** 已在外部展示模式时隐藏 game_mode */
  hideGameMode?: boolean;
  /** 已在外部展示大区/区服时隐藏 */
  hideServerRegion?: boolean;
};

export function ProfileFieldsDisplay({
  schema,
  fieldValues,
  gameSlug,
  hideGameMode,
  hideServerRegion,
}: Props) {
  const fields = schema.fields.filter((field) => {
    if (hideGameMode && field.key === 'game_mode') return false;
    if (hideServerRegion && field.key === GAME_SERVER_REGION_FIELD) return false;
    if (RANK_SUB_KEYS.has(field.key)) return false;
    if (!isFieldVisible(field, fieldValues)) return false;
    return hasDisplayValue(fieldValues[field.key], field.type);
  });

  if (fields.length === 0) return null;

  return (
    <div className="square-player-fields">
      {fields.map((field) => (
        <ProfileFieldItem
          key={field.key}
          field={field}
          value={fieldValues[field.key]}
          fieldValues={fieldValues}
          gameSlug={gameSlug}
        />
      ))}
    </div>
  );
}

function ProfileFieldItem({
  field,
  value,
  fieldValues,
  gameSlug,
}: {
  field: GameFieldDefinition;
  value: unknown;
  fieldValues: Record<string, unknown>;
  gameSlug: string;
}) {
  const isFullWidth =
    field.type === 'image' || field.type === 'textarea' || field.key === 'bio';

  return (
    <div
      className={`square-player-field${isFullWidth ? ' span-full' : ''}`}
    >
      <span className="square-player-field-label">{field.label}</span>
      <FieldValueContent
        field={field}
        value={value}
        fieldValues={fieldValues}
        gameSlug={gameSlug}
      />
    </div>
  );
}

function FieldValueContent({
  field,
  value,
  fieldValues,
  gameSlug,
}: {
  field: GameFieldDefinition;
  value: unknown;
  fieldValues: Record<string, unknown>;
  gameSlug: string;
}) {
  switch (field.type) {
    case 'image': {
      const urls = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="square-player-screenshots">
          {urls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="square-player-screenshot glass-panel"
              title="点击查看大图"
            >
              <img src={url} alt={field.label} />
            </a>
          ))}
        </div>
      );
    }
    case 'multiselect': {
      const items = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="square-player-chips">
          {items.map((item) => (
            <span key={item} className="square-player-chip">
              {item}
            </span>
          ))}
        </div>
      );
    }
    case 'boolean':
      return (
        <p className="square-player-field-value">
          {Boolean(value) ? '是' : '否'}
        </p>
      );
    case 'textarea':
      return (
        <p className="square-player-field-value square-player-bio">
          {String(value)}
        </p>
      );
    case 'number':
      return (
        <p className="square-player-field-value">{String(value)}</p>
      );
    default:
      if (field.key === 'rank') {
        return (
          <p className="square-player-field-value">
            {formatGameRank(gameSlug, fieldValues)}
          </p>
        );
      }
      return (
        <p className="square-player-field-value">{String(value)}</p>
      );
  }
}
