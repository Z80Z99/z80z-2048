// planned-red-core.mjs — GREEN assertions (W1-B landed).
// These tests were RED markers before W1-B; they now assert the
// implemented contracts.

import assert from 'node:assert/strict';

export async function run() {
  const { loadProject } = await import('../harness.mjs');

  // ── 1. gainXp from core/progress ──────────────────────────────────
  {
    const progress = loadProject('./core/progress');
    assert.strictEqual(typeof progress.gainXp, 'function', 'gainXp must be exported');

    // gainXp(60, 1, 25): 60 >= 25 → xp=35, level=2, next=25+(2-1)*12=37
    const r1 = progress.gainXp(60, 1, 25);
    assert.deepStrictEqual(r1, { xp: 35, level: 2, next: 37 });

    // gainXp(14, 2, 37): 14 < 37 → no level-up
    const r2 = progress.gainXp(14, 2, 37);
    assert.deepStrictEqual(r2, { xp: 14, level: 2, next: 37 });
  }

  // ── 2. upgradeCost / equipCost / rarityText ───────────────────────
  {
    const upgrade = loadProject('./core/upgrade');
    const equipment = loadProject('./core/equipment');

    assert.strictEqual(upgrade.upgradeCost({ rarity: 'common' }), 20);
    assert.strictEqual(upgrade.upgradeCost({ rarity: 'rare' }), 50);
    assert.strictEqual(upgrade.upgradeCost({ rarity: 'epic' }), 80);

    assert.strictEqual(equipment.equipCost({ rarity: 'common' }), 30);
    assert.strictEqual(equipment.equipCost({ rarity: 'rare' }), 70);
    assert.strictEqual(equipment.equipCost({ rarity: 'epic' }), 120);

    assert.strictEqual(upgrade.rarityText('common'), '普通');
    assert.strictEqual(upgrade.rarityText('rare'), '稀有');
    assert.strictEqual(upgrade.rarityText('epic'), '史诗');
  }

  // ── 3. resolveRound determinism contract ──────────────────────────
  {
    const battle = loadProject('./core/battle');
    assert.strictEqual(
      battle.resolveRound.length,
      3,
      'resolveRound must accept 3 params (battle, player, rng)'
    );
  }
}
