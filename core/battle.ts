import type { BattleState, CardModifiers, Cell, EquipSetEffects, PlayerStats, RoundResult } from '../types'
import { initGrid, slideGrid, spawnTile, spawnTileWithValue, halveGridTiles } from './board'
import { emptyCardModifiers } from './cardEffects'
import { ROUND_ATK_BONUS, ROUND_DEF_BONUS, ROUND_SPD_BONUS } from './enemy'
import { computeEquipBonuses, getEffectivePlayer, rollEquipEffects } from './equipment'

// 评级没有叠层上限；自然分数把正评级转换为有限的概率/保留比例。
function naturalFraction(rating: number): number {
  return rating > 0 ? rating / (1 + rating) : 0
}

export function getCombinedCardModifiers(battle: BattleState): CardModifiers {
  const combined = emptyCardModifiers()
  for (const source of [battle.cardModifiers, battle.battleModifiers, battle.roundModifiers]) {
    if (!source) continue
    for (const key of Object.keys(combined) as (keyof CardModifiers)[]) combined[key] += source[key] ?? 0
  }
  return combined
}

function validateStartingPoints(points: number): number {
  if (!Number.isSafeInteger(points) || points < 0 || points % 2 !== 0) {
    throw new RangeError('开局点数必须是非负偶数安全整数；超出 JavaScript 精确整数范围的点数不能无损放置')
  }
  return points
}

// 只按空格数量放置，最多 16 格；满盘不抽签，未放下的点数始终保留。
export function placeStartingPoints(grid: Cell[][], pending: number, rng: () => number): { grid: Cell[][]; pending: number; placed: number } {
  validateStartingPoints(pending)
  let placed = 0
  while (pending >= 2) {
    let value = 2 ** Math.min(52, Math.floor(Math.log2(pending)))
    if (value > pending) value /= 2
    const spawned = spawnTileWithValue(grid, rng, value)
    if (!spawned) break
    grid = spawned
    pending -= value
    placed += value
  }
  return { grid, pending, placed }
}

function grantStartingPoints(battle: BattleState, grid: Cell[][], points: number, rng: () => number): Pick<BattleState, 'grid' | 'startingPointsPending' | 'startingPointsGranted' | 'startingPointsPlaced'> {
  validateStartingPoints(points)
  const pending = validateStartingPoints(battle.startingPointsPending ?? 0)
  const granted = validateStartingPoints((battle.startingPointsGranted ?? pending) + points)
  const placedBefore = validateStartingPoints(battle.startingPointsPlaced ?? 0)
  const placement = placeStartingPoints(grid, validateStartingPoints(pending + points), rng)
  return {
    grid: placement.grid,
    startingPointsPending: placement.pending,
    startingPointsGranted: granted,
    startingPointsPlaced: validateStartingPoints(placedBefore + placement.placed),
  }
}

export function initBattle(
  enemy: BattleState['enemy'],
  playerMaxTurns: number,
  rng: () => number,
  startingPoints = 0,
  cardModifiers: Partial<CardModifiers> = {},
): BattleState {
  validateStartingPoints(startingPoints)
  const placement = placeStartingPoints(initGrid(rng), startingPoints, rng)
  return {
    grid: placement.grid,
    turnsUsed: 0,
    maxTurns: playerMaxTurns,
    baseTurns: playerMaxTurns,
    totalAttack: cardModifiers.chargeStart ?? 0,
    totalDefense: 0,
    enemy,
    enemyCurrentHp: enemy.hp,
    phase: 'playing',
    result: null,
    round: 1,
    lastRoundResult: null,
    savedSteps: 0,
    fortifyUsed: false,
    cardModifiers: { ...emptyCardModifiers(), ...cardModifiers },
    roundModifiers: {},
    battleModifiers: {},
    startingPointsPending: placement.pending,
    startingPointsGranted: startingPoints,
    startingPointsPlaced: placement.placed,
    comboStreak: 0,
    mergeCount: 0,
    mechanicArmor: 0,
    carryArmor: 0,
    lastMergedSum: 0,
    lastMoveDamage: 0,
  }
}

// 移动自伤由 store 在移动后立即扣除；战斗纯函数不持有、也不修改玩家生命。
export function getMoveSelfDamage(battle: BattleState): number {
  return Math.max(0, battle.lastMoveDamage ?? 0)
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

  const modifiers = getCombinedCardModifiers(battle)
  const merged = slide.mergedSum > 0
  // 连锁回响：未合并的回合按自然分数保留连锁（向下取整），没有该机制时依旧归零。
  const comboStreak = merged
    ? (battle.comboStreak ?? 0) + 1
    : Math.floor((battle.comboStreak ?? 0) * naturalFraction(modifiers.comboGrace))
  const baseCharge = slide.mergedSum * (1 + modifiers.mergeCoefficient) * (1 + modifiers.burstCoefficient)
  const earnedCharge = (baseCharge + (merged ? modifiers.comboBonus * comboStreak : 0)) / (1 + Math.max(0, modifiers.chargeLoss))
  const spawn = spawnTile(slide.grid, rng, 0.1 + 0.9 * naturalFraction(modifiers.spawnLuck))
  const placement = grantStartingPoints(battle, spawn.grid, 0, rng)
  const newTurnsUsed = battle.turnsUsed + 1
  const updated: BattleState = {
    ...battle,
    ...placement,
    turnsUsed: newTurnsUsed,
    totalAttack: battle.totalAttack + earnedCharge,
    totalDefense: battle.totalDefense + spawn.spawnedValue,
    comboStreak,
    mergeCount: (battle.mergeCount ?? 0) + (merged ? 1 : 0),
    mechanicArmor: (battle.mechanicArmor ?? 0) + (merged && modifiers.mergeArmor > 0 ? slide.mergedSum * modifiers.mergeArmor : 0),
    lastMergedSum: slide.mergedSum,
    lastMoveDamage: merged ? Math.max(0, modifiers.soulRecoil) : 0,
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

// rawPlayer 为已派生白卡、但未叠装备的基础属性。只读虚空抽签与卡牌快照，不产生随机数。
export function getBattlePreview(battle: BattleState, rawPlayer: PlayerStats): BattlePreview {
  const effects = getBattleEffects(battle, rawPlayer)
  const modifiers = getCombinedCardModifiers(battle)
  const player = getEffectivePlayer(rawPlayer, effects)
  // 前两回合敌人不成长，给前期战斗一个公平窗口；阴影低语自选诅咒不受缓冲。
  const growthRounds = Math.max(0, battle.round - 2)
  let enemyAttack = Math.max(0, battle.enemy.attack + growthRounds * ROUND_ATK_BONUS + (battle.round - 1) * modifiers.enemyRage)
  if (effects.enemyAtkDown && enemyAttack > 0) enemyAttack = Math.max(1, Math.floor(enemyAttack * (1 - effects.enemyAtkDown)))

  const scaledDefense = battle.enemy.defense + growthRounds * ROUND_DEF_BONUS
  const enemyDefense = effects.pierce ? Math.floor(scaledDefense * (1 - effects.pierce)) : scaledDefense
  let enemySpeed = battle.enemy.speed + growthRounds * ROUND_SPD_BONUS
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
  const enemyDamage = battle.totalAttack > 0 ? Math.max(0, Math.floor(battle.totalAttack * player.attackMultiplier - enemyDefense) + player.flatAttack) : 0
  // 防御收益：棋盘和 × 倍率 ÷ 3（原 ÷6 过度稀释，防御卡几乎无效——前期平衡修正）。
  const defenseValue = Math.floor(boardSum * player.defenseMultiplier / 3
    + battle.totalDefense * ((player.spawnArmor ?? 0) + modifiers.spawnArmor)
    + (battle.mechanicArmor ?? 0) + (battle.carryArmor ?? 0))
  const armorDamage = enemyAttack > 0 ? Math.max(1, Math.ceil(enemyAttack * 15 / (15 + Math.max(0, defenseValue + player.flatDefense)))) : 0
  const incomingDamage = enemyAttack > 0 ? Math.max(1, Math.ceil(armorDamage * (1 + modifiers.vulnerability))) : 0
  const playerDamage = effects.fortify && !battle.fortifyUsed ? Math.ceil(incomingDamage / 2) : incomingDamage
  return { player, playerDamage, enemyDamage, playerSpeed, enemySpeed, playerFirst, defenseValue, enemyAttack, enemyDefense }
}

export function resolveRound(
  battle: BattleState,
  rawPlayer: PlayerStats,
  rng: () => number,
): RoundResult {
  let effects = getBattleEffects(battle, rawPlayer)
  const modifiers = getCombinedCardModifiers(battle)
  // 正常流程预先抽取并保存；独立调用者使用显式 rng，已有抽签绝不重新抽取。
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
  let curseDamage = 0
  let extraDamage = 0
  let enemyHealing = 0
  let attackCount = 0
  let playerActed = false
  let enemyActed = false
  let avoidReason: RoundResult['avoidReason'] = null
  let fortifyUsed = !!battle.fortifyUsed
  let fortifyTriggered = false

  const heal = (amount: number) => {
    if (playerHpAfter <= 0 || amount <= 0) return
    const reduced = amount / (1 + Math.max(0, modifiers.healingPenalty))
    const actual = Math.max(0, Math.min(preview.player.maxHp - playerHpAfter, Math.floor(reduced)))
    playerHpAfter += actual
    healing += actual
  }
  const takeCurseDamage = (amount: number) => {
    if (playerHpAfter <= 0 || amount <= 0) return
    const actual = Math.min(playerHpAfter, amount)
    playerHpAfter = Math.max(0, playerHpAfter - actual)
    curseDamage += actual
  }
  const attack = (extra: boolean) => {
    if (playerHpAfter <= 0 || enemyHpAfter <= 0 || battle.totalAttack <= 0) return
    playerActed = true
    attackCount++
    // 致命节奏：仅持有暴击卡时消耗抽签，倍伤同时放大溢出与吸血基数；不改变无卡时的 rng 序列。
    const critMultiplier = modifiers.critRating > 0 && rng() < naturalFraction(modifiers.critRating) ? 2 : 1
    const strikeDamage = Math.max(0, Math.floor(preview.enemyDamage * critMultiplier))
    const hpDamage = Math.min(enemyHpAfter, strikeDamage)
    if (extra) extraDamage += hpDamage
    else enemyDamage = strikeDamage
    overflowDamage += Math.max(0, strikeDamage - enemyHpAfter)
    enemyHpAfter -= hpDamage
    // 猎手印记：一击后敌人剩余生命不超过最大生命的自然分数时直接补刀；补刀计入溢出。
    const executeLine = Math.floor(battle.enemy.maxHp * naturalFraction(modifiers.executeRating))
    if (executeLine > 0 && enemyHpAfter > 0 && enemyHpAfter <= executeLine) {
      overflowDamage += enemyHpAfter
      enemyHpAfter = 0
    }
    // 装备固定吸血与红卡自然分数相加，最多恢复本次真实生命伤害，不计溢出/反弹/斩杀。
    heal(hpDamage * Math.min(1, naturalFraction(modifiers.lifestealRating) + (effects.lifesteal ?? 0)))
  }
  const playerAttack = () => {
    attack(false)
    // 每回合最多一次追加攻击；首击击杀、先手敌人致死均不抽取无意义概率。
    if (attackCount === 1 && playerHpAfter > 0 && enemyHpAfter > 0 && modifiers.extraStrikeRating > 0 && rng() < naturalFraction(modifiers.extraStrikeRating)) {
      attack(true)
      takeCurseDamage(modifiers.backlash)
    }
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
    // 致命来袭也反弹；已死玩家不能攻击/吸血/再生。调用者优先判定玩家死亡。
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
  // 装备再生保留原有百分比；没有成功合并的回合不提供免费再生。
  if (roundStarted && playerHpAfter > 0 && (battle.mergeCount ?? 0) > 0) heal(preview.player.maxHp * (effects.regen ?? 0))
  // 红卡流血与紫卡灼烧都是玩家代价，生命实际扣除计入独立诅咒伤害。
  if (roundStarted) {
    takeCurseDamage(modifiers.bleed)
    takeCurseDamage(modifiers.burn)
  }
  if (roundStarted && enemyHpAfter > 0 && modifiers.enemyRegen > 0) {
    enemyHealing = Math.max(0, Math.min(battle.enemy.maxHp - enemyHpAfter, modifiers.enemyRegen))
    enemyHpAfter += enemyHealing
  }

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
    curseDamage,
    extraDamage,
    enemyHealing,
    attackCount,
    playerActed,
    enemyActed,
    avoidReason,
    fortifyUsed,
    fortifyTriggered,
  }
}

export function startNewRound(battle: BattleState, rng: () => number, startingPoints = 0): BattleState {
  const modifiers = getCombinedCardModifiers(battle)
  // 脆甲诅咒：侵蚀评级直接抵扣传承评级，可把保留比例压到 0。
  const carryRetention = naturalFraction(Math.max(0, modifiers.armorCarry - modifiers.armorErosion))
  const carryArmor = ((battle.mechanicArmor ?? 0) + (battle.carryArmor ?? 0)) * carryRetention
  const halveShield = naturalFraction(modifiers.halveShield)
  const placement = grantStartingPoints(battle, halveGridTiles(battle.grid, rng, halveShield), startingPoints, rng)
  // 剩余步数在本轮开始时重算（提前结束时 turnsUsed 小于上限），再按过载核心转为初始蓄力。
  const savedSteps = Math.max(0, battle.maxTurns - battle.turnsUsed)
  return {
    ...battle,
    ...placement,
    turnsUsed: 0,
    totalAttack: savedSteps * modifiers.savedStepsCharge + modifiers.chargeStart,
    totalDefense: 0,
    phase: 'playing',
    round: battle.round + 1,
    lastRoundResult: null,
    savedSteps,
    roundModifiers: {},
    comboStreak: 0,
    mergeCount: 0,
    mechanicArmor: 0,
    carryArmor,
    lastMergedSum: 0,
    lastMoveDamage: 0,
  }
}
