// simulate.mjs — Full-game simulation driving the REAL Pinia store.
// Runs a complete game from START_RUN through all screens, dumping a
// deterministic baseline snapshot for regression anchoring.
//
// Exports runSim(seed) for reuse by tools/parity.mjs.
// When run directly (`node tools/simulate.mjs`), uses seed 12345,
// writes baseline.snapshot.json, and prints the SHA-256.

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProject } from './harness.mjs';

const _req = createRequire(import.meta.url);
const pinia = _req('pinia');

// ── Simulation parameters ────────────────────────────────────────
const DEFAULT_SEED = 12345;
const MAX_ITERATIONS = 20000;
const STUCK_THRESHOLD = 4; // consecutive SLIDEs with no turnsUsed change

// ── Direction cycle for SLIDE ────────────────────────────────────
const DIRECTIONS = ['up', 'left', 'down', 'right'];

// ── Reusable simulation ──────────────────────────────────────────
export function runSim(seed = DEFAULT_SEED) {
  const battleStats = { rounds: 0, kills: 0, turns: 0 };

  pinia.setActivePinia(pinia.createPinia());
  const gameStoreMod = loadProject('./store/gameStore');
  const store = gameStoreMod.useGameStore();

  store.START_RUN(seed);

  // If meta_start gave us a reward, pick the first one
  if (store.screen === 'reward') {
    if (store.rewardChoices.length > 0) {
      const firstId = store.rewardChoices[0].id;
      store.PICK_UPGRADE(firstId);
    } else {
      store.SKIP_REWARD();
    }
  }

  // ── Main loop ────────────────────────────────────────────────────
  let iterations = 0;
  let stuckCounter = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // ── Terminal screens ───────────────────────────────────────────
    if (store.screen === 'title' || store.screen === 'gameover' || store.screen === 'meta') {
      break;
    }

    // ── Route ──────────────────────────────────────────────────────
    if (store.screen === 'route') {
      const node = store.route.find(n => n.accessible && !n.completed);
      if (!node) break; // no more nodes on route
      store.SELECT_NODE(node.id);
      continue;
    }

    // ── Battle ─────────────────────────────────────────────────────
    if (store.screen === 'battle') {
      const b = store.battle;
      if (!b) { store.screen = 'route'; continue; }

      if (b.phase === 'playing') {
        const dirIdx = b.turnsUsed % DIRECTIONS.length;
        const prevTurns = b.turnsUsed;
        store.SLIDE(DIRECTIONS[dirIdx]);

        // Check if still playing and turns didn't change
        if (store.battle && store.battle.phase === 'playing') {
          if (store.battle.turnsUsed === prevTurns) {
            stuckCounter++;
            if (stuckCounter >= STUCK_THRESHOLD) {
              store.END_TURN_EARLY();
              stuckCounter = 0;
            }
          } else {
            stuckCounter = 0;
          }
        } else {
          stuckCounter = 0;
        }
        continue;
      }

      if (b.phase === 'round_delay') {
        store.SHOW_ROUND();
        continue;
      }

      if (b.phase === 'round_end') {
        store.NEXT_ROUND();
        continue;
      }

      if (b.phase === 'finish_delay') {
        // Capture battle stats before clearing
        if (b.result) {
          battleStats.rounds += b.round;
          battleStats.turns += b.turnsUsed;
          if (b.result.playerWon) battleStats.kills++;
        }
        store.SHOW_BATTLE_RESULT();
        // phase now 'finished' — loop around to handle below
        continue;
      }

      if (b.phase === 'finished') {
        store.END_BATTLE();
        continue;
      }

      // Unknown phase — bail
      break;
    }

    // ── Reward ─────────────────────────────────────────────────────
    if (store.screen === 'reward') {
      if (store.rewardChoices && store.rewardChoices.length > 0) {
        store.PICK_UPGRADE(store.rewardChoices[0].id);
      } else {
        store.SKIP_REWARD();
      }
      continue;
    }

    // ── Shop ───────────────────────────────────────────────────────
    if (store.screen === 'shop') {
      store.GO_TO_ROUTE();
      continue;
    }

    // ── Rest ───────────────────────────────────────────────────────
    if (store.screen === 'rest') {
      store.GO_TO_ROUTE();
      continue;
    }

    // ── Event ──────────────────────────────────────────────────────
    if (store.screen === 'event') {
      if (store.gameEvent && store.gameEvent.choices.length > 0) {
        store.RESOLVE_EVENT(0);
        store.APPLY_EVENT();
      } else {
        store.screen = 'route';
      }
      continue;
    }

    // ── Boss choice ────────────────────────────────────────────────
    if (store.screen === 'boss_choice') {
      if (store.stage < 3) {
        store.BOSS_DEFEATED('continue');
      } else {
        store.BOSS_DEFEATED('end');
      }
      continue;
    }

    // ── Unknown screen ─────────────────────────────────────────────
    // If we get here, something unexpected happened
    console.error(`Unexpected screen state: ${store.screen} at iteration ${iterations}`);
    break;
  }

  // ── Build snapshot ───────────────────────────────────────────────
  const snapshot = {
    seed,
    stagesCleared: store.stage - 1,
    screen: store.screen,
    player: {
      hp: store.player.hp,
      maxHp: store.player.maxHp,
      gold: store.player.gold,
      xp: store.player.xp,
      level: store.player.level,
    },
    upgradeIds: [...store.upgrades.map(u => u.def.id)].sort(),
    meta: {
      totalGold: store.meta.totalGold,
      totalRuns: store.meta.totalRuns,
      unlockedEnemies: store.meta.unlockedEnemies.length,
      enemyKills: store.meta.enemyKills,
    },
    battleStats: {
      rounds: battleStats.rounds,
      kills: battleStats.kills,
      turns: battleStats.turns,
    },
  };

  const json = JSON.stringify(snapshot, null, 2);
  const hash = createHash('sha256').update(json).digest('hex');

  return { snapshot, hash, iterations, battleStats };
}

// ── CLI entry (behaviour identical to the pre-refactor script) ───
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMain) {
  const { snapshot, hash, iterations } = runSim(DEFAULT_SEED);

  // ── Write baseline ───────────────────────────────────────────────
  const outPath = path.resolve(import.meta.dirname, 'baseline.snapshot.json');
  const json = JSON.stringify(snapshot, null, 2);
  fs.writeFileSync(outPath, json, 'utf8');

  // ── Report ───────────────────────────────────────────────────────
  console.log(`Iterations: ${iterations}`);
  console.log(`Screen: ${snapshot.screen}`);
  console.log(`Stages cleared: ${snapshot.stagesCleared}`);
  console.log(`Player: hp=${snapshot.player.hp}/${snapshot.player.maxHp} gold=${snapshot.player.gold} xp=${snapshot.player.xp} level=${snapshot.player.level}`);
  console.log(`Upgrades: ${snapshot.upgradeIds.length} ids`);
  console.log(`Battle: ${snapshot.battleStats.rounds} rounds, ${snapshot.battleStats.kills} kills, ${snapshot.battleStats.turns} turns`);
  console.log(`Meta: gold=${snapshot.meta.totalGold} runs=${snapshot.meta.totalRuns} enemies=${snapshot.meta.unlockedEnemies}`);
  console.log(`SHA-256: ${hash}`);
}