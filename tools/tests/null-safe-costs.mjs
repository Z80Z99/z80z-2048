// null-safe-costs.mjs — W-fix regression tests.
// Bug: ShopScreen template called equipCost(ALL_EQUIPMENT.find(e => e.id === eid))
// where eid is a COMPOUND id (baseId:level:fluct) — find never matched, returned
// undefined, and equipCost(undefined).rarity crashed Vue's render (empty shop).
// RED: these assertions fail on the buggy code. GREEN: after null-safe fix.

import assert from 'node:assert/strict';

export async function run() {
  const { loadProject } = await import('../harness.mjs');
  const equipment = loadProject('./core/equipment');
  const upgrade = loadProject('./core/upgrade');

  // ── 1. equipCost / upgradeCost must never throw on undefined (crash source) ──
  assert.strictEqual(equipment.equipCost(undefined), 30, 'equipCost(undefined) defaults to common (30)');
  assert.strictEqual(upgrade.upgradeCost(undefined), 20, 'upgradeCost(undefined) defaults to common (20)');

  // ── 2. compound-id lookup invariant: baseId prefix must find the definition ──
  // ShopScreen renders `ALL_EQUIPMENT.find(e => e.id === eid.split(':')[0])`.
  for (const eq of equipment.ALL_EQUIPMENT.slice(0, 10)) {
    const compound = equipment.makeEquipId(eq.id, 1);
    const found = equipment.ALL_EQUIPMENT.find(e => e.id === compound.split(':')[0]);
    assert.ok(found, `compound id ${compound} resolves to a definition via baseId`);
    assert.strictEqual(found.id, eq.id, 'baseId resolution returns the same definition');
    assert.strictEqual(equipment.equipCost(found), equipment.equipCost(eq), 'cost derived from the resolved def matches');
  }

  // ── 3. normal rarity costs unchanged (behavior preservation) ──
  assert.strictEqual(equipment.equipCost({ rarity: 'rare' }), 70);
  assert.strictEqual(equipment.equipCost({ rarity: 'epic' }), 120);
  assert.strictEqual(upgrade.upgradeCost({ rarity: 'rare' }), 50);
  assert.strictEqual(upgrade.upgradeCost({ rarity: 'epic' }), 80);
}
