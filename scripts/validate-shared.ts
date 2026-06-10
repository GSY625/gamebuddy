import assert from 'node:assert/strict';
import {
  GAME_SERVER_REGION_FIELD,
  getServerRegionsForSlug,
  MVP_GAMES_SEED,
  requiresServerRegionSelection,
} from '../packages/shared/src/index';

for (const game of MVP_GAMES_SEED) {
  assert.ok(game.slug, 'game slug should be defined');
  assert.ok(game.name, `game ${game.slug} should have a name`);
  assert.equal(game.schema.version, 1, `${game.slug} should use schema version 1`);

  const fieldKeys = new Set<string>();
  for (const field of game.schema.fields) {
    assert.ok(field.key, `${game.slug} has a field without a key`);
    assert.ok(!fieldKeys.has(field.key), `${game.slug} has duplicate field key ${field.key}`);
    fieldKeys.add(field.key);

    if (field.type === 'select' || field.type === 'multiselect') {
      assert.ok(Array.isArray(field.options), `${game.slug}:${field.key} should define options`);
      assert.ok(field.options!.length > 0, `${game.slug}:${field.key} should have options`);
    }

    if (field.showWhen) {
      assert.ok(
        fieldKeys.has(field.showWhen.field) || game.schema.fields.some((candidate) => candidate.key === field.showWhen!.field),
        `${game.slug}:${field.key} references missing dependency ${field.showWhen.field}`,
      );
    }
  }

  if (requiresServerRegionSelection(game.slug)) {
    assert.ok(
      fieldKeys.has(GAME_SERVER_REGION_FIELD),
      `${game.slug} should include ${GAME_SERVER_REGION_FIELD}`,
    );
    assert.ok(
      getServerRegionsForSlug(game.slug).length > 0,
      `${game.slug} should expose server regions`,
    );
  }
}

const slugs = MVP_GAMES_SEED.map((game) => game.slug);
assert.equal(new Set(slugs).size, slugs.length, 'game slugs should be unique');

console.log(`validated ${MVP_GAMES_SEED.length} shared game catalog entries`);
