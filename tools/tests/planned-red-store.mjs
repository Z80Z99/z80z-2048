// planned-red-store.mjs — GREEN assertions for W1-C (store/helpers).
// Validates rollRewardChoices and buildShop exports and behavior.

import assert from 'node:assert/strict';

export async function run() {
  const { loadProject } = await import('../harness.mjs');

  const storeHelpers = loadProject('./store/helpers');
  const random  = loadProject('./core/random');
  const upgrade = loadProject('./core/upgrade');

  // ── 1. Exports exist ───────────────────────────────────────────
  {
    assert.strictEqual(
      typeof storeHelpers.rollRewardChoices,
      'function',
      'GREEN: rollRewardChoices exported from store/helpers'
    );
    assert.strictEqual(
      typeof storeHelpers.buildShop,
      'function',
      'GREEN: buildShop exported from store/helpers'
    );
  }

  // ── 2. rollRewardChoices behavior ─────────────────────────────
  {
    // ── 2a. Basic call: 3 results from valid pool ────────────────
    const rng = random.createRng(42);
    const result = storeHelpers.rollRewardChoices(rng, [], {});
    assert.strictEqual(result.length, 3, 'rollRewardChoices returns 3 items');
    for (const u of result) {
      assert.ok(typeof u.id === 'string', `UpgradeDef has id string: ${u.id}`);
      assert.ok(typeof u.name === 'string', `UpgradeDef has name string: ${u.name}`);
      assert.ok(typeof u.rarity === 'string', `UpgradeDef has rarity string: ${u.rarity}`);
      assert.ok(typeof u.effect === 'object', `UpgradeDef has effect object`);
    }

    // ── 2b. Match characterization pinned ids (excludeHeal:true, hpRatio:1) ──
    // characterization.mjs pins pickUpgrades(createRng(42), [], {}, 3, true, 1)
    // → ['spawn_red_2', 'bonus_turn_1', 'atk_up_3']
    const rng2 = random.createRng(42);
    const pinnedResult = storeHelpers.rollRewardChoices(rng2, [], {
      excludeHeal: true,
      hpRatio: 1,
    });
    assert.strictEqual(pinnedResult.length, 3, 'pinned: 3 items');
    assert.deepStrictEqual(
      pinnedResult.map(u => u.id),
      ['spawn_red_2', 'bonus_turn_1', 'atk_up_3'],
      'pinned ids match characterization (excludeHeal:true, hpRatio:1)'
    );

    // ── 2c. Determinism: same seed → identical output ────────────
    const rngA = random.createRng(99);
    const rngB = random.createRng(99);
    const resultA = storeHelpers.rollRewardChoices(rngA, [], { count: 5 });
    const resultB = storeHelpers.rollRewardChoices(rngB, [], { count: 5 });
    assert.deepStrictEqual(
      resultA.map(u => u.id),
      resultB.map(u => u.id),
      'determinism: same RNG seed yields identical upgrade ids'
    );
  }

  // ── 3. buildShop behavior ─────────────────────────────────────
  {
    const rng = random.createRng(7);
    const shop = storeHelpers.buildShop(rng, 1);

    // ── 3a. Shape check ──────────────────────────────────────────
    assert.strictEqual(Array.isArray(shop.shopUpgrades), true, 'shopUpgrades is array');
    assert.strictEqual(shop.shopUpgrades.length, 3, 'shopUpgrades length 3');
    assert.strictEqual(Array.isArray(shop.shopEquipment), true, 'shopEquipment is array');
    assert.strictEqual(shop.shopEquipment.length, 3, 'shopEquipment length 3');
    assert.strictEqual(Array.isArray(shop.shopHeals), true, 'shopHeals is array');
    assert.strictEqual(shop.shopHeals.length, 1, 'shopHeals length 1');
    assert.strictEqual(shop.shopRefreshCost, 10, 'shopRefreshCost 10');
    assert.strictEqual(shop.shopRemoveCost, 30, 'shopRemoveCost 30');
    assert.strictEqual(shop.shopRemoveUsed, false, 'shopRemoveUsed false');

    // ── 3b. Upgrade slots are null or valid UPGRADE_POOL ids ─────
    const validIds = new Set(upgrade.UPGRADE_POOL.map(u => u.id));
    for (const uid of shop.shopUpgrades) {
      if (uid !== null) {
        assert.ok(validIds.has(uid), `shopUpgrade "${uid}" is a valid UPGRADE_POOL id`);
      }
    }

    // ── 3c. Equipment slots are non-null compound ids ────────────
    for (const eid of shop.shopEquipment) {
      assert.ok(typeof eid === 'string', `shopEquipment slot is a string`);
      assert.ok(eid.includes(':'), `shopEquipment "${eid}" is a compound id (contains colon)`);
    }

    // ── 3d. Heal slot is a valid heal upgrade id ─────────────────
    const healDefs = upgrade.UPGRADE_POOL.filter(u => u.effect.type === 'heal');
    const healIds = new Set(healDefs.map(u => u.id));
    const healSlot = shop.shopHeals[0];
    assert.ok(healSlot !== null, 'heal slot is not null (heal pool is non-empty)');
    assert.ok(healIds.has(healSlot), `heal slot "${healSlot}" is a valid heal upgrade id`);
  }
}
