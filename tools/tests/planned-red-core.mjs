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

  // ── 2. sixcolor card costs / unchanged equipment rarity costs ────
  {
    const upgrade = loadProject('./core/upgrade');
    const equipment = loadProject('./core/equipment');

    for (const [cardClass, cost] of [['white', 20], ['blue', 50], ['gold', 90], ['red', 0], ['purple', null], ['black', null]]) {
      assert.strictEqual(upgrade.upgradeCost({ cardClass }), cost);
    }
    assert.strictEqual(upgrade.upgradeCost(undefined), null);
    assert.strictEqual(upgrade.upgradeCost({ cardClass: 'unknown' }), null);

    assert.strictEqual(equipment.equipCost({ rarity: 'common' }), 30);
    assert.strictEqual(equipment.equipCost({ rarity: 'rare' }), 70);
    assert.strictEqual(equipment.equipCost({ rarity: 'epic' }), 120);

    for (const [cardClass, text] of [['white', '白色·属性'], ['blue', '蓝色·参数'], ['gold', '金色·机制'], ['red', '红色·风险'], ['purple', '紫色·诅咒'], ['black', '黑色·宿命']]) {
      assert.strictEqual(upgrade.cardClassText(cardClass), text);
    }
    assert.strictEqual(upgrade.cardClassText('unknown'), '未知卡牌');
    for (const [id, amount] of [['heal_1', 12], ['heal_2', 30]]) {
      const heal = upgrade.cardById(id);
      assert.strictEqual(heal.cardClass, 'white');
      assert.strictEqual(heal.kind, 'instant', 'heals are immediate, not held cards');
      assert.strictEqual(heal.effects.length, 1);
      assert.strictEqual(heal.effects[0].type, 'heal');
      assert.strictEqual(heal.effects[0].value, amount);
      assert.strictEqual(heal.effects[0].polarity, 'positive');
      assert.ok(!Object.hasOwn(heal, 'effect') && !Object.hasOwn(heal, 'rarity') && !Object.hasOwn(heal, 'maxStacks'));
    }
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
