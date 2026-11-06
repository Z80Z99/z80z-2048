import type { BattleState, EquipSetEffects, PlayerStats, RoundResult } from '../types'
import { initGrid, slideGrid, spawnTile, spawnTileWithValue, halveGridTiles } from './board'
import { ROUND_ATK_BONUS, ROUND_DEF_BONUS, ROUND_SPD_BONUS } from './enemy'
import { computeEquipBonuses, getEffectivePlayer, rollEquipEffects } from './equipment'

export function initBattle(
  enemy: BattleState['enemy'],
  playerMaxTurns: number,
  rng: () => number,
  startingTileBonuses: number[] = [],
): BattleState {
  let grid = initGrid(rng)
  for (const val of startingTileBonuses) {
    const bonusResult = spawnTileWithValue(grid, rng, val)
    if (bonusResult) grid = bonusResult
  }
  return {
    grid,
    turnsUsed: 0,
    maxTurns: playerMaxTurns,
    totalAttack: 0,
    totalDefense: 0,
    enemy,
    enemyCurrentHp: enemy.hp,
    phase: 'playing',
    result: null,
    round: 1,
    lastRoundResult: null,
    savedSteps: 0,
    fortifyUsed: false,
  }
}

export function processTurn(
  battle: BattleState,
  direction: string,
  rng: () => number,
): BattleState {
  if (battle.phase !== 'playing') return battle
  if (direction !== 'up' && direction !== 'down' && direction !== 'left' && direction !== 'right') return battle

  const slide = slideGrid(battle.grid, direction)
  if (!slide.moved) return battle

  const spawn = spawnTile(slide.grid, rng)
  const newTurnsUsed = battle.turnsUsed + 1
  const updated: BattleState = {
    ...battle,
    grid: spawn.grid,
    turnsUsed: newTurnsUsed,
    totalAttack: battle.totalAttack + slide.mergedSum,
    totalDefense: battle.totalDefense + spawn.spawnedValue,
  }
  return newTurnsUsed >= battle.maxTurns ? { ...updated, phase: 'round_delay' } : updated
}

export interface BattlePreview {
  player: PlayerStats
  // 双方实际出手时的单次伤害；不预测闪避、停手、死亡阻止出手或反弹。
  playerDamage: number
  enemyDamage: number
  playerSpeed: number
  enemySpeed: number
  playerFirst: boolean
  defenseValue: number
  enemyAttack: number
  // 已计入本回合成长和穿透后的防御，正是伤害公式采用的数值。
  enemyDefense: number
}

function getBattleEffects(battle: BattleState, player: PlayerStats): Partial<EquipSetEffects> {
  return { ...computeEquipBonuses(player.equipment).setEffects, ...battle.equipEffects }
}

// 预览只读已抽取的虚空属性，不产生随机数，也不消耗首击守护。
export function getBattlePreview(battle: BattleState, rawPlayer: PlayerStats): BattlePreview {
  const effects = getBattleEffects(battle, rawPlayer)
  const player = getEffectivePlayer(rawPlayer, effects)
  let enemyAttack = Math.max(1, battle.enemy.attack + (battle.round - 1) * ROUND_ATK_BONUS - player.enemyAtkDown)
  if (effects.enemyAtkDown) enemyAttack = Math.floor(enemyAttack * (1 - effects.enemyAtkDown))

  const scaledDefense = battle.enemy.defense + (battle.round - 1) * ROUND_DEF_BONUS
  const enemyDefense = effects.pierce ? Math.floor(scaledDefense * (1 - effects.pierce)) : scaledDefense
  let enemySpeed = battle.enemy.speed + (battle.round - 1) * ROUND_SPD_BONUS
  if (effects.enemySpdDown) enemySpeed = Math.max(1, enemySpeed - effects.enemySpdDown)

  let boardSum = 0
  let emptyCells = 0
  for (const row of battle.grid) {
    for (const cell of row) {
      boardSum += cell.value
      if (cell.value === 0) emptyCells++
    }
  }
  const playerSpeed = player.baseSpeed + emptyCells
  const playerFirst = !!effects.firstStrike || playerSpeed >= enemySpeed
  const enemyDamage = Math.max(0, Math.floor(battle.totalAttack * player.attackMultiplier - enemyDefense) + player.flatAttack)
  const defenseValue = Math.floor(boardSum * player.defenseMultiplier * (1 + player.spawnReduction) / 6)
  const incomingDamage = Math.max(0, enemyAttack - defenseValue - player.flatDefense)
  // 整数伤害向上取整，保证守护触发于实际受伤而不是凭空消耗；不改防御公式。
  const playerDamage = effects.fortify && !battle.fortifyUsed ? Math.ceil(incomingDamage / 2) : incomingDamage
  return { player, playerDamage, enemyDamage, playerSpeed, enemySpeed, playerFirst, defenseValue, enemyAttack, enemyDefense }
}

export function resolveRound(
  battle: BattleState,
  rawPlayer: PlayerStats,
  rng: () => number,
): RoundResult {
  let effects = getBattleEffects(battle, rawPlayer)
  // 正常流程在回合开始预先抽取并保存，保证预览与结算一致。
  // 独立调用者未抽取时也必须使用显式 rng；已有抽签绝不重新抽取。
  if (rawPlayer.hp > 0 && battle.enemyCurrentHp > 0 && ((effects.randomBonus && !effects.randomStat) || (effects.randomDouble && !effects.doubleStat))) {
    const rolled = rollEquipEffects({
      randomBonus: effects.randomStat ? 0 : effects.randomBonus,
      randomDouble: effects.doubleStat ? false : effects.randomDouble,
    }, rng)
    effects = { ...effects, randomStat: effects.randomStat ?? rolled.randomStat, doubleStat: effects.doubleStat ?? rolled.doubleStat }
  }
  const preview = getBattlePreview({ ...battle, equipEffects: effects }, rawPlayer)
  let playerHpAfter = preview.player.hp
  let enemyHpAfter = Math.max(0, battle.enemyCurrentHp)
  const roundStarted = playerHpAfter > 0 && enemyHpAfter > 0
  let playerDamage = 0
  let enemyDamage = 0
  let overflowDamage = 0
  let healing = 0
  let reflectedDamage = 0
  let playerActed = false
  let enemyActed = false
  let avoidReason: RoundResult['avoidReason'] = null
  let fortifyUsed = !!battle.fortifyUsed
  let fortifyTriggered = false

  const heal = (amount: number) => {
    if (playerHpAfter <= 0 || amount <= 0) return
    const actual = Math.min(preview.player.maxHp - playerHpAfter, Math.floor(amount))
    playerHpAfter += actual
    healing += actual
  }

  const playerAttack = () => {
    if (playerHpAfter <= 0 || enemyHpAfter <= 0) return
    playerActed = true
    enemyDamage = preview.enemyDamage
    const hpDamage = Math.min(enemyHpAfter, enemyDamage)
    overflowDamage = Math.max(0, enemyDamage - enemyHpAfter)
    enemyHpAfter -= hpDamage
    // 每次成功攻击均可吸血，只有真实扣除的敌人生命参与计算（反弹与溢出不算）。
    heal(hpDamage * (effects.lifesteal ?? 0))
  }

  const enemyAttack = () => {
    if (enemyHpAfter <= 0) {
      avoidReason = 'kill'
      return
    }
    if (playerHpAfter <= 0) return
    if (effects.skipChance && rng() < effects.skipChance) {
      avoidReason = 'skip'
      return
    }
    enemyActed = true
    if (preview.playerDamage <= 0) {
      avoidReason = 'defense'
      return
    }
    if (effects.dodge && rng() < effects.dodge) {
      avoidReason = 'dodge'
      return
    }
    playerDamage = preview.playerDamage
    playerHpAfter = Math.max(0, playerHpAfter - playerDamage)
    // 每场仅在首次实际来袭伤害触发减伤和固定反弹；闪避/停手/格挡不消耗。
    // 致命一击也反弹，但死亡玩家不会攻击、吸血或再生；胜负由调用者优先判死。
    if (effects.fortify && !fortifyUsed) {
      fortifyUsed = true
      fortifyTriggered = true
      reflectedDamage = Math.min(enemyHpAfter, Math.max(0, effects.reflect ?? 0))
      enemyHpAfter -= reflectedDamage
    }
  }

  if (preview.playerFirst) {
    playerAttack()
    enemyAttack()
  } else {
    enemyAttack()
    playerAttack()
  }
  if (roundStarted && playerHpAfter > 0) heal(preview.player.maxHp * (effects.regen ?? 0))

  return {
    playerDamage,
    enemyDamage,
    enemyHpAfter,
    overflowDamage,
    playerFirst: preview.playerFirst,
    playerSpeed: preview.playerSpeed,
    enemySpeed: preview.enemySpeed,
    playerHpAfter,
    healing,
    reflectedDamage,
    playerActed,
    enemyActed,
    avoidReason,
    fortifyUsed,
    fortifyTriggered,
  }
}

export function startNewRound(battle: BattleState, rng: () => number, startingTileBonuses: number[] = []): BattleState {
  let grid = halveGridTiles(battle.grid)
  for (const val of startingTileBonuses) {
    const bonusResult = spawnTileWithValue(grid, rng, val)
    if (bonusResult) grid = bonusResult
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
  }
}
