// planned-red-store.mjs — GREEN assertions for W1-C (store/helpers).
// Validates rollRewardChoices and buildShop exports and behavior.

import assert from 'node:assert/strict';

export async function run() {
  const { loadProject } = await import('../harness.mjs');

  const storeHelpers = loadProject('./store/helpers');
  const random  = loadProject('./core/random');
  const upgrade = loadProject('./core/upgrade');
  const equipment = loadProject('./core/equipment');
  const consumables = loadProject('./core/consumables');

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
      assert.ok(upgrade.CARD_CLASSES.includes(u.cardClass), `UpgradeDef has registered card class: ${u.cardClass}`);
      assert.ok(['persistent', 'instant'].includes(u.kind), `UpgradeDef has explicit kind: ${u.kind}`);
      assert.ok(Array.isArray(u.effects) && u.effects.length > 0, 'UpgradeDef has nonempty effects array');
      assert.ok(upgrade.validateCard(u), `${u.id}: valid sixcolor definition`);
      assert.strictEqual(upgrade.cardById(u.id), u, 'reward ID resolves to its exact registry definition');
      assert.ok(!Object.hasOwn(u, 'rarity') && !Object.hasOwn(u, 'effect') && !Object.hasOwn(u, 'maxStacks'), 'no legacy rarity, singular effect or stack cap');
      assert.ok(['white', 'blue', 'gold'].includes(u.cardClass), 'normal rewards exclude risk, curse and doom');
    }

    // ── 2b. Match characterization pinned ids (excludeHeal:true, hpRatio:1) ──
    // characterization.mjs pins the full-HP, non-healing sixcolor options
    // → ['atk_up_2', 'start_tile_1', 'max_hp_1']
    const rng2 = random.createRng(42);
    const pinnedResult = storeHelpers.rollRewardChoices(rng2, [], {
      excludeHeal: true,
      hpRatio: 1,
    });
    assert.strictEqual(pinnedResult.length, 3, 'pinned: 3 items');
    assert.deepStrictEqual(
      pinnedResult.map(u => u.id),
      ['start_tile_1', 'spawn_luck_1', 'balanced_1'],
      'pinned ids match characterization (excludeHeal:true, hpRatio:1)'
    );

    assert.deepStrictEqual(pinnedResult.map(u => u.cardClass), ['blue', 'blue', 'white']);
    assert.ok(pinnedResult.every(u => u.kind === 'persistent'), 'explicit healing exclusion survives helper delegation');

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
    assert.strictEqual(Array.isArray(shop.shopConsumables), true, 'shopConsumables is array');
    assert.strictEqual(shop.shopConsumables.length, 2, 'shopConsumables length 2');
    assert.strictEqual(shop.shopRefreshCost, 10, 'shopRefreshCost 10');
    assert.strictEqual(shop.shopRemoveCost, 30, 'shopRemoveCost 30');
    assert.strictEqual(shop.shopRemoveUsed, false, 'shopRemoveUsed false');

    // ── 3b. Upgrade slots are null or valid UPGRADE_POOL ids ─────
    const validIds = new Set(upgrade.UPGRADE_POOL.map(u => u.id));
    for (const uid of shop.shopUpgrades) {
      if (uid !== null) {
        assert.ok(validIds.has(uid), `shopUpgrade "${uid}" is a valid UPGRADE_POOL id`);
        const def = upgrade.cardById(uid);
        assert.ok(['white', 'blue', 'gold'].includes(def.cardClass), 'normal card sale excludes red risk, purple curse and black doom');
        assert.strictEqual(def.kind, 'persistent', 'instant healing uses a separate shop slot');
        assert.strictEqual(upgrade.upgradeCost(def), { white: 20, blue: 50, gold: 90 }[def.cardClass]);
      }
    }

    // ── 3c. Equipment slots are non-null compound ids ────────────
    for (const eid of shop.shopEquipment) {
      assert.ok(typeof eid === 'string', `shopEquipment slot is a string`);
      assert.ok(eid.includes(':'), `shopEquipment "${eid}" is a compound id (contains colon)`);
      const def = equipment.equipmentById(eid);
      assert.ok(def && equipment.ALL_EQUIPMENT.some(eq => eq.id === def.id), 'compound equipment ID resolves to unchanged equipment registry');
      assert.strictEqual(equipment.equipCost(def), { common: 30, rare: 70, epic: 120 }[def.rarity]);
    }

    // ── 3d. Heal slot is a valid heal upgrade id ─────────────────
    const healDefs = upgrade.UPGRADE_POOL.filter(u => u.kind === 'instant' && u.effects.some(effect => effect.type === 'heal'));
    const healIds = new Set(healDefs.map(u => u.id));
    const healSlot = shop.shopHeals[0];
    assert.ok(healSlot !== null, 'heal slot is not null (heal pool is non-empty)');
    assert.ok(healIds.has(healSlot), `heal slot "${healSlot}" is a valid heal upgrade id`);
    assert.deepStrictEqual(healDefs.map(def => [def.id, def.effects[0].value]), [['heal_1', 12], ['heal_2', 30]], 'unchanged instant supply IDs, approved flat heal amounts');
    assert.strictEqual(storeHelpers.instantSupplyCost(upgrade.cardById('heal_1')), 20, 'small instant heal price');
    assert.strictEqual(storeHelpers.instantSupplyCost(upgrade.cardById('heal_2')), 50, 'large instant heal price');

    // ── 3e. Consumables use their own exact-ID registry, not held card IDs ──
    const supplyIds = new Set(consumables.CONSUMABLE_POOL.map(def => def.id));
    assert.strictEqual(new Set(shop.shopConsumables).size, 2, 'consumable offers are distinct');
    for (const id of shop.shopConsumables) {
      assert.ok(supplyIds.has(id), `shop consumable "${id}" is a valid registry ID`);
      assert.ok(consumables.validateConsumable(consumables.consumableById(id)));
      assert.ok(!validIds.has(id), 'consumables are not persistent card grants');
    }
    assert.deepStrictEqual(storeHelpers.buildShop(random.createRng(7), 1), shop, 'shop including supplies remains seeded and deterministic');
  }
}
