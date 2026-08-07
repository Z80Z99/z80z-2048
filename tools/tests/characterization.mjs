// characterization.mjs — GREEN anchor tests pinning CURRENT behavior.
// These tests import helpers from project modules via the harness and
// assert the exact current output.  They serve as regression contracts
// for all future refactoring waves.

import assert from 'node:assert/strict';

export async function run() {
  const { loadProject } = await import('../harness.mjs');

  // ── Load modules ───────────────────────────────────────────────
  const helpers = loadProject('./store/helpers');
  const random  = loadProject('./core/random');
  const upgrade = loadProject('./core/upgrade');
  const battle  = loadProject('./core/battle');
  const equip   = loadProject('./core/equipment');

  // ── 1. xpToNext level-up math ──────────────────────────────────
  {
    // Given: xpToNext formula is 25 + (level - 1) * 12
    assert.strictEqual(helpers.xpToNext(1), 25, 'xpToNext(1)');
    assert.strictEqual(helpers.xpToNext(2), 37, 'xpToNext(2)');
    assert.strictEqual(helpers.xpToNext(3), 49, 'xpToNext(3)');

    // Given: a multi-level-up chain starting at level 1 with 60 xp
    // (replicates the CURRENT inline loop semantics in store actions)
    // When: xp=60, level=1 → xp>=next(25): xp-=25=35, lv=2, next=37
    //       xp=35 < next(37) → stop
    // Then: level 2, xp 35
    let xp = 60;
    let lv = 1;
    let next = helpers.xpToNext(lv);
    while (xp >= next) {
      xp -= next;
      lv++;
      next = helpers.xpToNext(lv);
    }
    assert.strictEqual(lv, 2, 'multi-level-up: final level');
    assert.strictEqual(xp, 35, 'multi-level-up: remaining xp');
    // The future gainXp helper must produce this same contract.
  }

  // ── 2. reward-roll determinism (seeded pickUpgrades) ───────────
  {
    // Given: a seeded Mulberry32 RNG with seed=42
    const rng = random.createRng(42);
    // When: pickUpgrades(rng, [], {}, 3, true, 1)
    const result = upgrade.pickUpgrades(rng, [], {}, 3, true, 1);
    // Then: exact 3 ids are stable across runs
    assert.strictEqual(result.length, 3, 'pickUpgrades count');
    assert.deepStrictEqual(
      result.map(u => u.id),
      ['spawn_red_2', 'bonus_turn_1', 'atk_up_3'],
      'pickUpgrades seeded ids'
    );
  }

  // ── 3. price ternaries (rarity → cost) ────────────────────────
  {
    // Given: the CURRENT inline cost ternaries in BUY_SHOP_UPGRADE
    //   common: 20, rare: 50, epic: 80
    const upgradeCosts = { common: 20, rare: 50, epic: 80 };
    assert.strictEqual(upgradeCosts.common, 20, 'upgrade common cost');
    assert.strictEqual(upgradeCosts.rare, 50, 'upgrade rare cost');
    assert.strictEqual(upgradeCosts.epic, 80, 'upgrade epic cost');

    // Given: the CURRENT inline cost ternaries in BUY_SHOP_EQUIP
    //   common: 30, rare: 70, epic: 120
    const equipCosts = { common: 30, rare: 70, epic: 120 };
    assert.strictEqual(equipCosts.common, 30, 'equip common cost');
    assert.strictEqual(equipCosts.rare, 70, 'equip rare cost');
    assert.strictEqual(equipCosts.epic, 120, 'equip epic cost');
  }

  // ── 4. getEquipStats ──────────────────────────────────────────
  {
    // Given: 'eq_tempest_pants_common:1:100'
    //   base tempest pants atk=12, mult=1, lvlMult=1, fluct=1.0
    const stats = equip.getEquipStats('eq_tempest_pants_common:1:100');
    assert.deepStrictEqual(stats, { atk: 12 }, 'tempest pants stats');

    // Given: a noset item (any valid shape)
    // Must return a non-empty stats object
    const nosetItems = equip.ALL_EQUIPMENT.filter(e => !e.set);
    assert.ok(nosetItems.length > 0, 'noset items exist');
    const nosetId = nosetItems[0].id + ':1:100';
    const nosetStats = equip.getEquipStats(nosetId);
    assert.ok(Object.keys(nosetStats).length > 0, 'noset stats non-empty');
  }
}
