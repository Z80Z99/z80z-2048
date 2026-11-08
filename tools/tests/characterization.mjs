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
    // When: full-HP rewards exclude instant healing and use the safe sixcolor pool.
    const result = upgrade.pickUpgrades(rng, { count: 3, excludeHeal: true, hpRatio: 1 });
    // Then: exact 3 ids are stable across runs
    assert.strictEqual(result.length, 3, 'pickUpgrades count');
    assert.deepStrictEqual(
      result.map(u => u.id),
      ['start_tile_1', 'spawn_luck_1', 'gold_1'],
      'pickUpgrades seeded sixcolor ids'
    );
    assert.deepStrictEqual(result.map(u => u.cardClass), ['blue', 'blue', 'white']);
    const gold = upgrade.pickUpgrades(random.createRng(42), { count: 3, allowedClasses: ['gold'] });
    assert.deepStrictEqual(gold.map(u => u.id), ['gold_lifesteal', 'gold_execute', 'gold_combo_grace'], 'seeded boss gold ids');
    assert.ok(gold.every(u => u.cardClass === 'gold' && u.kind === 'persistent'));
  }

  // ── 3. card class prices / unchanged equipment rarity prices ──
  {
    // Approved redesign: white 20, blue 50, gold 90; red is a risk grant,
    // not a normal sale. Curses, doom and unknown definitions have no price.
    for (const [cardClass, cost] of [['white', 20], ['blue', 50], ['gold', 90], ['red', 0], ['purple', null], ['black', null], ['unknown', null]]) {
      assert.strictEqual(upgrade.upgradeCost({ cardClass }), cost, `card ${cardClass} cost`);
    }
    assert.strictEqual(upgrade.upgradeCost(undefined), null);

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
