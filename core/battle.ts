import { BattleResult, BattleState, PlayerStats, RoundResult } from '../types';
import { initGrid, slideGrid, spawnTile, spawnTileWithValue, halveGridTiles } from './board';
import { ROUND_ATK_BONUS, ROUND_DEF_BONUS, ROUND_SPD_BONUS } from './enemy';

export function initBattle(
  enemy: { hp: number; [key: string]: any },
  playerMaxTurns: number,
  rng: () => number,
  startingTileBonuses: number[] = [],
): BattleState {
  let grid = initGrid(rng);
  for (const val of startingTileBonuses) {
    const bonusResult = spawnTileWithValue(grid, rng, val);
    if (bonusResult) grid = bonusResult;
  }
  return {
    grid,
    turnsUsed: 0,
    maxTurns: playerMaxTurns,
    totalAttack: 0,
    totalDefense: 0,
    enemy: enemy as BattleState['enemy'],
    enemyCurrentHp: enemy.hp,
    phase: 'playing',
    result: null,
    round: 1,
    lastRoundResult: null,
    savedSteps: 0,
  };
}

export function processTurn(
  battle: BattleState,
  direction: string,
  rng: () => number,
): BattleState {
  if (battle.phase !== 'playing') return battle;

  const slide = slideGrid(battle.grid, direction as 'up' | 'down' | 'left' | 'right');
  if (!slide.moved) return battle;

  const spawn = spawnTile(slide.grid, rng);
  const newTurnsUsed = battle.turnsUsed + 1;

  const updated: BattleState = {
    ...battle,
    grid: spawn.grid,
    turnsUsed: newTurnsUsed,
    totalAttack: battle.totalAttack + slide.mergedSum,
    totalDefense: battle.totalDefense + spawn.spawnedValue,
  };

  if (newTurnsUsed >= battle.maxTurns) {
    return { ...updated, phase: 'round_delay' };
  }

  return updated;
}

export function resolveRound(
  battle: BattleState,
  player: PlayerStats,
  rng?: () => number,
): RoundResult {
  const _rng = rng || Math.random;
  const eff = battle.equipEffects || {};

  // Enemy stats scale linearly with round number
  let scaledAtk = Math.max(1, battle.enemy.attack + (battle.round - 1) * ROUND_ATK_BONUS - player.enemyAtkDown);

  // Apply set effects
  if (eff.enemyAtkDown) scaledAtk = Math.floor(scaledAtk * (1 - eff.enemyAtkDown));
  if (eff.enemySpdDown) scaledAtk = Math.max(1, scaledAtk); // speed down doesn't affect enemy attack

  let scaledDef = battle.enemy.defense + (battle.round - 1) * ROUND_DEF_BONUS;
  let scaledSpd = battle.enemy.speed + (battle.round - 1) * ROUND_SPD_BONUS;
  if (eff.enemySpdDown) scaledSpd = Math.max(1, scaledSpd - eff.enemySpdDown);

  // Count board state for defense + speed
  let boardSum = 0;
  let emptyCells = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = battle.grid[r][c].value;
      boardSum += v;
      if (v === 0) emptyCells++;
    }
  }

  // Player speed = base + empty cells
  let playerSpeed = player.baseSpeed + emptyCells;

  // First strike override
  let playerFirst = eff.firstStrike ? true : (playerSpeed >= scaledSpd);

  // Calculate damages
  let atkMultiplier = player.attackMultiplier;
  if (eff.doubleAtk) atkMultiplier *= 2;

  // Pierce: ignore % of enemy defense
  const effectiveDef = eff.pierce ? Math.floor(scaledDef * (1 - eff.pierce)) : scaledDef;
  const playerDmg = Math.max(0, Math.floor(battle.totalAttack * atkMultiplier - effectiveDef) + player.flatAttack);

  // Defense value
  let defMult = player.defenseMultiplier;
  if (eff.fortify) defMult *= 1.5; // fortify: first hit damage halved → def * 1.5
  const defValue = Math.floor(boardSum * defMult * (1 + player.spawnReduction) / 6);

  let enemyDmg = Math.max(0, scaledAtk - defValue - player.flatDefense);

  // Dodge: chance to avoid damage
  if (eff.dodge && _rng() < eff.dodge) enemyDmg = 0;

  let enemyHpAfter: number;
  let finalPlayerDamage: number;
  let finalEnemyDamage: number;
  let playerAvoided = false;

  if (playerFirst) {
    finalEnemyDamage = playerDmg;
    const afterPlayerAtk = battle.enemyCurrentHp - playerDmg;
    if (afterPlayerAtk <= 0) {
      enemyHpAfter = 0;
      finalPlayerDamage = 0;
    } else {
      enemyHpAfter = afterPlayerAtk;
      // SkipChance: enemy may skip counter
      if (eff.skipChance && _rng() < eff.skipChance) {
        finalPlayerDamage = 0;
        playerAvoided = true;
      } else {
        finalPlayerDamage = enemyDmg;
      }
    }
  } else {
    if (eff.skipChance && _rng() < eff.skipChance) {
      finalPlayerDamage = 0;
      playerAvoided = true;
    } else {
      finalPlayerDamage = enemyDmg;
    }
    finalEnemyDamage = playerDmg;
    enemyHpAfter = Math.max(0, battle.enemyCurrentHp - playerDmg);
  }

  const overflowDamage = enemyHpAfter <= 0 ? Math.abs(battle.enemyCurrentHp - playerDmg) : 0;

  return {
    playerDamage: finalPlayerDamage,
    enemyDamage: finalEnemyDamage,
    enemyHpAfter: Math.max(0, enemyHpAfter),
    overflowDamage,
    playerFirst,
    playerSpeed,
    enemySpeed: scaledSpd,
  };
}

export function startNewRound(battle: BattleState, rng: () => number, startingTileBonuses: number[] = []): BattleState {
  let grid = halveGridTiles(battle.grid);
  for (const val of startingTileBonuses) {
    const bonusResult = spawnTileWithValue(grid, rng, val);
    if (bonusResult) grid = bonusResult;
  }
  return {
    ...battle,
    grid,
    turnsUsed: 0,
    totalAttack: 0,
    totalDefense: 0,
    phase: 'playing',
    round: battle.round + 1,
    lastRoundResult: null,
    savedSteps: battle.savedSteps,
  };
}
