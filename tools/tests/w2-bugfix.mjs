// w2-bugfix.mjs — END_TURN_EARLY applies equipment rewards and updates bestiary.
// Treasure deliberately fixes the historical doubleGold bug: 5pc raises drop
// rarity, while gear + 2pc grant additive gold percentages and 3pc grants XP.

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

  // ── Equip 5 treasure items → cumulative rewards + higher drop rarity ──
  store.player.equipment = {
    pants: 'eq_treasure_pants_common:1:100',
    helmet: 'eq_treasure_helmet_common:1:100',
    armor: 'eq_treasure_armor_common:1:100',
    gloves: 'eq_treasure_gloves_common:1:100',
    boots: 'eq_treasure_boots_common:1:100',
  };
  const bonuses = equipmentMod.computeEquipBonuses(store.player.equipment);
  assert.equal(bonuses.setEffects.doubleGold, false, 'treasure never grants double gold');
  assert.equal(bonuses.setEffects.dropRarityBoost, 1, '5pc treasure raises equipment rarity one tier');
  assert.equal(bonuses.setEffects.goldBonus, 0.25, '2pc treasure grants +25% gold');
  assert.equal(bonuses.setEffects.xpBonus, 0.3, '3pc treasure grants +30% XP');
  assert.equal(bonuses.stats.gold, 40, 'five common treasure pieces add +40% gear gold');

  // ── Enter a battle node ──────────────────────────────────────────
  const battleNode = store.route.find(
    n => n.accessible && !n.completed && n.type === 'battle',
  );
  assert.ok(battleNode, 'route has an accessible battle node');
  store.SELECT_NODE(battleNode.id);
  assert.strictEqual(store.screen, 'battle', 'entered battle screen');
  assert.equal(store.battle.equipEffects.doubleGold, false, 'battle has no false doubleGold flag');
  assert.equal(store.battle.equipEffects.dropRarityBoost, 1, 'battle retains treasure drop quality bonus');

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
  store.player.xpBoost = 0;

  // ── When: END_TURN_EARLY kills the enemy ────────────────────────
  store.END_TURN_EARLY();

  // ── Then: use the real, additive treasure reward multipliers ─────
  // Gold = floor(15 * (1 + .40 gear + .25 set)) + 10 saved steps * 2 = 44.
  // XP = floor((8 + floor(9999 / 8)) * (1 + .30 set)) = 1634.
  assert.equal(store.player.gold, 44, 'treasure gold includes gear + set percentages, not doubling');
  assert.equal(store.battle.result.goldEarned, 44, 'recorded gold matches the amount awarded');
  assert.equal(store.battle.result.xpEarned, 1634, 'treasure grants its actual +30% XP bonus');

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