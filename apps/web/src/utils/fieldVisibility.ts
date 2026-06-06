import type { GameFieldDefinition } from '@gamebuddy/shared';

export function isFieldVisible(
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
