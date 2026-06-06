import { useEffect, useState } from 'react';
import type { GameFieldDefinition, GameFieldSchema } from '@gamebuddy/shared';
import {
  GAME_SERVER_REGION_FIELD,
  isLolModeWithoutRank,
  isWzryGame,
  LOL_RANK_FIELD_KEYS,
  getLolLaneOptions,
  getWzryDivisionOptions,
  stripLolRankFields,
} from '@gamebuddy/shared';
import { api } from '@gamebuddy/api-client';
import { ImageUploadField } from './ImageUploadField';
import { ThemeSelect } from './ThemeSelect';
import { isFieldVisible } from '../utils/fieldVisibility';
import { useOnlineGuard } from '../hooks/useOnlineGuard';

type Props = {
  gameId: string;
  gameSlug?: string;
  schema: GameFieldSchema;
  /** 编辑已有方案时传入 */
  profileId?: string;
  initialName?: string;
  initial?: Record<string, unknown>;
  /** 新建时预填（如从模式选择页带入） */
  presetValues?: Record<string, unknown>;
  /** 已在外部选定模式时锁定，表单内不展示模式选择 */
  lockedMode?: string;
  /** 已在外部选定大区/区服时锁定 */
  lockedRegion?: string;
  /** 新建时是否清空表单 */
  resetKey?: number;
  onSaved?: () => void;
};

function FieldInput({
  field,
  value,
  values,
  onChange,
}: {
  field: GameFieldDefinition;
  value: unknown;
  values: Record<string, unknown>;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case 'select': {
      const rankTier = String(values.rank ?? '');
      const formatDivision = (div: string) =>
        field.key === 'rank_division' && rankTier
          ? `${rankTier}${div}`
          : div;

      return (
        <ThemeSelect
          value={String(value ?? '')}
          onChange={onChange}
          options={field.options ?? []}
          placeholder="请选择"
          required={field.required}
          formatOption={
            field.key === 'rank_division' ? formatDivision : undefined
          }
        />
      );
    }
    case 'multiselect':
      return (
        <div className="chip-group" role="group">
          {field.options?.map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const checked = arr.includes(o);
            return (
              <button
                key={o}
                type="button"
                className={`chip ${checked ? 'active' : ''}`}
                onClick={() => {
                  onChange(
                    checked ? arr.filter((x) => x !== o) : [...arr, o],
                  );
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    case 'boolean':
      return (
        <label className="checkbox-row glass-panel">
          <input
            type="checkbox"
            className="checkbox-input"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="checkbox-custom" aria-hidden />
          <span className="checkbox-text">{Boolean(value) ? '是' : '否'}</span>
        </label>
      );
    case 'number':
      return (
        <input
          type="text"
          inputMode="numeric"
          className="input-themed input-no-spinner"
          value={value === undefined || value === null ? '' : String(value)}
          placeholder={field.placeholder}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '');
            onChange(raw === '' ? undefined : Number(raw));
          }}
        />
      );
    case 'textarea':
      return (
        <textarea
          className="input-themed"
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      );
    case 'image': {
      const urls = Array.isArray(value) ? (value as string[]) : [];
      const max = field.maxImages ?? 3;
      return (
        <ImageUploadField
          urls={urls}
          maxImages={max}
          label={field.label}
          onUpload={async (file) => {
            const { url } = await api.uploadImage(file);
            if (urls.length >= max) return;
            onChange([...urls, url]);
          }}
          onRemove={(url) => onChange(urls.filter((u) => u !== url))}
        />
      );
    }
    default:
      return (
        <input
          type="text"
          className="input-themed"
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export function DynamicProfileForm({
  gameId,
  gameSlug,
  schema,
  profileId,
  initialName = '',
  initial,
  presetValues,
  lockedMode,
  lockedRegion,
  resetKey = 0,
  onSaved,
}: Props) {
  const { guard } = useOnlineGuard();
  const isEdit = Boolean(profileId);
  const hideRankFields = Boolean(
    lockedMode && isLolModeWithoutRank(lockedMode),
  );

  const mergeInitial = () => {
    let base = {
      ...(presetValues ?? {}),
      ...(initial ?? {}),
    };
    if (lockedMode) {
      base.game_mode = lockedMode;
    }
    if (lockedRegion) {
      base[GAME_SERVER_REGION_FIELD] = lockedRegion;
    }
    if (hideRankFields) {
      base = stripLolRankFields(base);
    }
    return base;
  };

  const sanitizeForSubmit = (raw: Record<string, unknown>) => {
    const mode = String(raw.game_mode ?? lockedMode ?? '');
    if (isLolModeWithoutRank(mode)) {
      return stripLolRankFields(raw);
    }
    return raw;
  };

  const isRankFieldHidden = (key: string) =>
    hideRankFields &&
    (LOL_RANK_FIELD_KEYS as readonly string[]).includes(key);
  const [schemeName, setSchemeName] = useState(initialName);
  const [values, setValues] = useState<Record<string, unknown>>(mergeInitial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setSchemeName(initialName);
    setValues(mergeInitial());
    setError('');
    setSuccess('');
  }, [initialName, initial, presetValues, lockedMode, lockedRegion, resetKey, profileId]);

  const setField = (key: string, v: unknown) => {
    setValues((prev) => {
      const next = { ...prev, [key]: v };
      if (key === 'rank') {
        const rank = String(v ?? '');
        for (const field of schema.fields) {
          if (field.showWhen?.field !== 'rank') continue;
          const visible = field.showWhen.oneOf?.includes(rank) ?? true;
          if (!visible) delete next[field.key];
        }
      }
      return next;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    guard(() => doSubmit());
  };

  const doSubmit = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    const name = schemeName.trim();
    if (!name) {
      setError('请填写方案名称');
      setSaving(false);
      return;
    }
    try {
      if (isEdit && profileId) {
        await api.updateProfileScheme(profileId, {
          name,
          fieldValues: sanitizeForSubmit(values),
        });
        setSuccess('方案已更新');
      } else {
        await api.createProfile(gameId, {
          name,
          fieldValues: sanitizeForSubmit(values),
          publishToSquare: true,
        });
        setSuccess('方案已保存并发布到广场');
        setValues({
          ...(presetValues ?? {}),
          ...(lockedMode ? { game_mode: lockedMode } : {}),
          ...(lockedRegion
            ? { [GAME_SERVER_REGION_FIELD]: lockedRegion }
            : {}),
        });
        setSchemeName('');
      }
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const visibleFields = schema.fields.filter(
    (f) =>
      isFieldVisible(f, values) &&
      !(lockedMode && f.key === 'game_mode') &&
      !(lockedRegion && f.key === GAME_SERVER_REGION_FIELD) &&
      !isRankFieldHidden(f.key),
  );

  const resolveField = (field: GameFieldDefinition) => {
    if (field.key === 'lane') {
      const mode = String(values.game_mode ?? lockedMode ?? '');
      return { ...field, options: getLolLaneOptions(mode) };
    }
    if (
      field.key === 'rank_division' &&
      gameSlug &&
      isWzryGame(gameSlug)
    ) {
      const rank = String(values.rank ?? '');
      return { ...field, options: getWzryDivisionOptions(rank) };
    }
    return field;
  };

  return (
    <form className="dynamic-form glass-panel" onSubmit={submit}>
      <div className="form-field">
        <span className="form-field-label">方案名称 *</span>
        <input
          type="text"
          className="input-themed"
          placeholder="例如：晚间排位、周末娱乐"
          value={schemeName}
          onChange={(e) => setSchemeName(e.target.value)}
          maxLength={32}
        />
      </div>
      {visibleFields.map((field) => {
        const resolved = resolveField(field);
        return (
          <div key={field.key} className="form-field">
            <span className="form-field-label">
              {resolved.label}
              {resolved.required ? ' *' : ''}
            </span>
            <FieldInput
              field={resolved}
              value={values[field.key]}
              values={values}
              onChange={(v) => setField(field.key, v)}
            />
          </div>
        );
      })}
      {error && <p className="error">{error}</p>}
      {success && <p className="success-msg">{success}</p>}
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? '保存中…' : isEdit ? '保存修改' : '保存并发布到广场'}
      </button>
    </form>
  );
}
