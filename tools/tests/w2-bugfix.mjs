// w2-bugfix.mjs — TDD test for W2 Step 6: END_TURN_EARLY now applies equip
// set-effects (doubleGold) and updates bestiary meta on enemy kill.
// RED on old code (pre-merge): gold lacks doubleGold, meta not updated.
// GREEN after _resolveKill unification.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

export async function run() {
  const { loadProject } = await import('../harness.mjs');
  const _req = createRequire(import.meta.url);
  const pinia = _req('pinia');

  // ── Given: fresh store with a run started ────────────────────────
  pinia.setActivePinia(pinia.createPinia());
  const storeMod = loadProject('./store/gameStore');
  const equipmentMod = loadProject('./core/equipment');
  const store = storeMod.useGameStore();

  store.START_RUN(42);
  // Clean meta for deterministic assertions
  store.meta.unlockedEnemies = [];
  store.meta.enemyKills = {};

  // ── Equip 5 treasure items → 5pc set bonus grants doubleGold ─────
  store.player.equipment = {
    pants: 'eq_treasure_pants_common:1:100',
    helmet: 'eq_treasure_helmet_common:1:100',
    armor: 'eq_treasure_armor_common:1:100',
    gloves: 'eq_treasure_gloves_common:1:100',
    boots: 'eq_treasure_boots_common:1:100',
  };
  const bonuses = equipmentMod.computeEquipBonuses(store.player.equipment);
  assert.ok(
    bonuses.setEffects.doubleGold === true,
    '5 treasure items grant doubleGold set effect',
  );

  // ── Enter a battle node ──────────────────────────────────────────
  const battleNode = store.route.find(
    n => n.accessible && !n.completed && n.type === 'battle',
  );
  assert.ok(battleNode, 'route has an accessible battle node');
  store.SELECT_NODE(battleNode.id);
  assert.strictEqual(store.screen, 'battle', 'entered battle screen');
  assert.ok(
    store.battle.equipEffects.doubleGold === true,
    'battle equipEffects carries doubleGold',
  );

  // ── Craft a killable battle state ────────────────────────────────
  const enemyId = store.battle.enemy.id;
  store.battle.totalAttack = 9999;
  store.battle.enemyCurrentHp = 1;
  store.battle.enemy = {
    ...store.battle.enemy,
    tier: 1,
    hp: 1,
    attack: 0,
    defense: 0,
    speed: 0,
    enemyUpgrades: [],
  };
  store.battle.maxTurns = 10;
  store.battle.turnsUsed = 0;
  store.battle.savedSteps = 0;
  store.player.hp = 100;
  store.player.maxHp = 100;
  store.player.gold = 0;
  store.player.goldBoost = 0;

  // ── When: END_TURN_EARLY kills the enemy ────────────────────────
  store.END_TURN_EARLY();

  // ── Then: gold includes doubleGold factor ───────────────────────
  // baseGold = floor(1 * 15 * (1 + 0 + 0)) * 1 = 15
  // doubleGold → 30; savedStepsBonus = 10 * 2 = 20 → goldEarned = 50
  // Old code (bug): 15 + 20 = 35 (no doubleGold, no rMult/equipEffects)
  const goldGained = store.player.gold;
  assert.ok(
    goldGained >= 50,
    `gold gained includes doubleGold: got ${goldGained}, expected >= 50`,
  );

  // ── And: bestiary meta updated (was missing on old END_TURN_EARLY) ──
  assert.ok(
    (store.meta.enemyKills[enemyId] || 0) >= 1,
    `meta.enemyKills incremented for ${enemyId}: ${store.meta.enemyKills[enemyId] || 0}`,
  );
  assert.ok(
    store.meta.unlockedEnemies.includes(enemyId),
    `meta.unlockedEnemies includes ${enemyId}`,
  );
}