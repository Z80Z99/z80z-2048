// Seeded, bounded policies driving the real Pinia store. No game-state shortcuts
// in normal runs; syntheticStage explicitly generates an unreachable fixture.
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProject } from './harness.mjs'

const pinia = createRequire(import.meta.url)('pinia')
const { slideGrid } = loadProject('./core/board')
const { cardById, UPGRADE_POOL, upgradeCost, canRemoveCard } = loadProject('./core/upgrade')
const { consumableById, CONSUMABLE_POOL } = loadProject('./core/consumables')
const { equipmentById, getEffectivePlayer, computeEquipBonuses, equipCost } = loadProject('./core/equipment')
const { getBattlePreview } = loadProject('./core/battle')
const { generateRoute } = loadProject('./core/route')
const { createScopedRng } = loadProject('./core/random')
const { useGameStore } = loadProject('./store/gameStore')

export const RULE_VERSION = 'sixcolor-v2-events25'
export const POLICY_VERSION = 1
export const STRATEGIES = ['baseline', 'corner', 'attack', 'defense', 'economy']
export const DEFAULT_SEED = 12345
export const BASELINE_DIRECTORY = path.join(import.meta.dirname, 'baselines')
const DIRECTIONS = ['up', 'left', 'down', 'right']
const CLASSES = ['white', 'blue', 'gold', 'red', 'purple', 'black']
const clone = value => JSON.parse(JSON.stringify(value))
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const increment = (object, key, amount = 1) => { object[key] = (object[key] ?? 0) + amount }
const ordered = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b, 'en')))

export function normalizeOptions(options = {}) {
  const result = {
    strategy: options.strategy ?? 'baseline',
    maxStage: options.maxStage ?? Math.max(3, options.syntheticStage ?? 1),
    maxIterations: options.maxIterations ?? 4000,
    maxBattleRounds: options.maxBattleRounds ?? 80,
    maxValidTurns: options.maxValidTurns ?? 2000,
    allowNegativeEvents: options.allowNegativeEvents ?? false,
    syntheticStage: options.syntheticStage ?? null,
  }
  if (!STRATEGIES.includes(result.strategy)) throw new RangeError(`Unknown strategy: ${result.strategy}`)
  for (const key of ['maxStage', 'maxIterations', 'maxBattleRounds', 'maxValidTurns']) {
    if (!Number.isSafeInteger(result[key]) || result[key] < 1) throw new RangeError(`${key} must be a positive safe integer`)
  }
  if (typeof result.allowNegativeEvents !== 'boolean') throw new TypeError('allowNegativeEvents must be boolean')
  if (result.syntheticStage !== null && (!Number.isSafeInteger(result.syntheticStage) || result.syntheticStage < 1 || result.syntheticStage > result.maxStage)) {
    throw new RangeError('syntheticStage must be a positive integer no greater than maxStage')
  }
  return result
}

let sourceFingerprint
export function getRuleFingerprint() {
  if (!sourceFingerprint) {
    const files = ['types/index.ts', 'core/board.ts', 'core/battle.ts', 'core/cardEffects.ts', 'core/consumables.ts', 'core/upgrade.ts', 'core/enemy.ts', 'core/equipment.ts', 'core/events.ts', 'core/route.ts', 'core/random.ts', 'core/progress.ts', 'store/gameStore.ts', 'store/helpers.ts', 'store/initialState.ts']
    sourceFingerprint = digest(files.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(import.meta.dirname, '..', file), 'utf8').replace(/\r\n/g, '\n')).digest('hex')]))
  }
  return sourceFingerprint
}

export function getCardCatalog() {
  return UPGRADE_POOL.map(def => ({ id: def.id, name: def.name, cardClass: def.cardClass, kind: def.kind, effects: clone(def.effects) }))
}

// slideGrid receives a copy, never the live board. Prediction neither spawns
// tiles nor calls a RNG. Animation IDs allocated by core are not policy inputs
// or regression metrics; only values/moved/mergedSum are retained.
export function predictDirections(grid) {
  return DIRECTIONS.map(direction => {
    const prediction = slideGrid(grid.map(row => row.map(cell => ({ ...cell, mergedFrom: cell.mergedFrom ? [...cell.mergedFrom] : undefined }))), direction)
    return { direction, moved: prediction.moved, mergedSum: prediction.mergedSum, values: prediction.grid.map(row => row.map(cell => cell.value)) }
  })
}

function directionScore(prediction, strategy) {
  const values = prediction.values
  const empty = values.flat().filter(value => value === 0).length
  let snake = 0, smoothness = 0
  const weights = [[16, 15, 14, 13], [9, 10, 11, 12], [8, 7, 6, 5], [1, 2, 3, 4]]
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const value = values[row][col] ? Math.log2(values[row][col]) : 0
    snake += value * weights[row][col]
    if (row < 3 && values[row][col] && values[row + 1][col]) smoothness -= Math.abs(value - Math.log2(values[row + 1][col]))
    if (col < 3 && values[row][col] && values[row][col + 1]) smoothness -= Math.abs(value - Math.log2(values[row][col + 1]))
  }
  if (strategy === 'corner') return snake + 12 * empty + 2 * smoothness + prediction.mergedSum
  if (strategy === 'defense') return 12 * empty + 3 * prediction.mergedSum + 0.15 * snake
  return 5 * prediction.mergedSum + 3 * empty + 0.08 * snake
}

export function chooseDirection(grid, turnsUsed = 0, strategy = 'baseline') {
  const predictions = predictDirections(grid).filter(result => result.moved)
  if (strategy === 'baseline') {
    for (let offset = 0; offset < DIRECTIONS.length; offset++) {
      const found = predictions.find(result => result.direction === DIRECTIONS[(turnsUsed + offset) % DIRECTIONS.length])
      if (found) return found.direction
    }
    return null
  }
  return predictions.sort((a, b) => directionScore(b, strategy) - directionScore(a, strategy))[0]?.direction ?? null
}

const POLICY_WEIGHTS = {
  baseline: { attack: 1, defense: 1, hp: 1, economy: 1 },
  corner: { attack: 1, defense: 1, hp: 1, economy: 0.7 },
  attack: { attack: 2, defense: 0.6, hp: 0.7, economy: 0.4 },
  defense: { attack: 0.8, defense: 2, hp: 1.5, economy: 0.4 },
  economy: { attack: 1, defense: 0.7, hp: 0.8, economy: 2.5 },
}
function cardScore(def, store, strategy) {
  const weights = POLICY_WEIGHTS[strategy]
  let score = 0
  for (const effect of def.effects) {
    const value = effect.value
    const attack = { attackBonus: 100, mergeCoefficient: 100, startingPoints: 4, comboBonus: 4, burstCoefficient: 25, extraStrikeRating: 20, critRating: 90, executeRating: 60, savedStepsCharge: 12, chargeStart: 12, comboGrace: 10 }
    const defense = { defenseBonus: 60, spawnArmor: 40, mergeArmor: 60, armorCarry: 35 }
    if (effect.type in attack) score += value * attack[effect.type] * weights.attack
    else if (effect.type in defense) score += value * defense[effect.type] * weights.defense
    else if (effect.type === 'bonusTurns') score += value * 18 * (weights.attack + weights.defense) / 2
    else if (effect.type === 'maxHpBonus') score += value * weights.hp
    else if (effect.type === 'lifestealRating') score += value * 120 * weights.hp
    else if (effect.type === 'goldBonus' || effect.type === 'greedRating') score += value * 120 * weights.economy
    else if (effect.type === 'xpBonus') score += value * 90 * weights.economy
    else if (effect.type === 'heal') score += Math.min(store.effectivePlayer.maxHp - store.player.hp, Math.floor(value / (1 + store.cardModifiers.healingPenalty))) * weights.hp * (store.player.hp / store.effectivePlayer.maxHp < 0.5 ? 2.5 : 1)
    else if (effect.polarity === 'negative') score -= value * 30
  }
  return score
}

function statScore(player, effects, strategy) {
  const weights = POLICY_WEIGHTS[strategy]
  return weights.attack * (player.attackMultiplier * 100 + player.flatAttack * 3 + (effects.extraTurns ?? 0) * 18 + (effects.lifesteal ?? 0) * 80 + (effects.pierce ?? 0) * 40)
    + weights.defense * (player.defenseMultiplier * 60 + player.flatDefense * 2 + (effects.regen ?? 0) * 150 + (effects.dodge ?? 0) * 50 + (effects.skipChance ?? 0) * 50)
    + weights.hp * player.maxHp + player.baseSpeed * 3 + weights.economy * (player.goldBoost * 100 + player.xpBoost * 60)
}
function equipmentScore(store, equipment, strategy) {
  const { setEffects } = computeEquipBonuses(equipment)
  return statScore(getEffectivePlayer({ ...store.cardPlayer, equipment }, setEffects), setEffects, strategy)
}
function bestEquipment(store, act, strategy) {
  if (strategy === 'baseline' || store.battle || store.eventResult || store.runOutcome) return
  // Two bounded greedy passes over real derived stats, including set bonuses.
  // This is not a global equipment optimizer or a human model.
  for (let pass = 0; pass < 2; pass++) for (const slot of ['pants', 'helmet', 'armor', 'gloves', 'boots']) {
    let best = store.player.equipment[slot]
    let score = equipmentScore(store, store.player.equipment, strategy)
    for (const id of store.player.inventory) {
      if (equipmentById(id)?.slot !== slot) continue
      const next = equipmentScore(store, { ...store.player.equipment, [slot]: id }, strategy)
      if (next > score + 1e-9) { best = id; score = next }
    }
    if (best && best !== store.player.equipment[slot]) act('EQUIP_ITEM', [best], 'equipment')
  }
}

function routeScore(node, store, strategy) {
  const ratio = store.player.hp / store.effectivePlayer.maxHp
  if (node.type === 'rest') return 15 + (1 - ratio) * (strategy === 'defense' ? 150 : 90)
  if (node.type === 'shop') return store.player.gold >= 30 ? (strategy === 'economy' ? 35 : 25) : 2
  if (node.type === 'event') return strategy === 'economy' ? 45 : 20
  if (node.type === 'elite') return (strategy === 'attack' && ratio > 0.65 ? 18 : -25) - (node.enemy?.attack ?? 0) / 10
  return 5 - (node.enemy?.attack ?? 0) / 10 - (node.enemy?.hp ?? 0) / 50
}

function eventHasNegative(effect) {
  if (['hp_reduce', 'hp_reduce_pct', 'maxhp_down', 'maxhp_down_pct', 'heal_curse', 'gamble', 'trap'].includes(effect.type)) return true
  for (const field of ['curse', 'curse_hp', 'hpCost', 'hp_lose', 'hp_dmg', 'lose_gold']) if (effect[field] > 0 || (effect[field] && typeof effect[field] === 'object')) return true
  return (effect.cardGrants ?? effect.grants ?? []).some(grant => !cardById(grant.id) || cardById(grant.id).effects.some(item => item.polarity === 'negative'))
    || (effect.consumableGrants ?? []).some(grant => consumableById(grant.id)?.effects.some(item => item.polarity === 'negative'))
}
const expectedNumber = value => typeof value === 'number' ? value : value && Number.isFinite(value.min) && Number.isFinite(value.max) ? (value.min + value.max) / 2 : 0
function eventScore(effect, store, strategy) {
  const weights = POLICY_WEIGHTS[strategy]
  const known = ['none', 'gold', 'heal', 'gold_heal', 'gold_xp', 'xp', 'maxhp_up', 'drop_equip', 'reforge', 'card_trade']
  if (!known.includes(effect.type)) return -1000
  let score = -expectedNumber(effect.cost) * 0.5 - expectedNumber(effect.hpCost) * 3
  if (effect.type === 'none') return 0
  if (effect.type === 'gold') score += expectedNumber(effect.value) * weights.economy
  else if (effect.type === 'heal') score += Math.min(store.effectivePlayer.maxHp - store.player.hp, store.effectivePlayer.maxHp * expectedNumber(effect.value) / 100) * weights.hp
  else if (effect.type === 'xp') score += expectedNumber(effect.value)
  else if (effect.type === 'maxhp_up') score += expectedNumber(effect.value) * weights.hp
  else if (effect.type === 'gold_heal' || effect.type === 'gold_xp') score += expectedNumber(effect.gold) * weights.economy + expectedNumber(effect.xp) + Math.min(store.effectivePlayer.maxHp - store.player.hp, store.effectivePlayer.maxHp * expectedNumber(effect.heal) / 100) * weights.hp
  else if (effect.type === 'drop_equip' || effect.type === 'reforge') score += 10
  else if (effect.type === 'card_trade') {
    score += expectedNumber(effect.gold) * weights.economy
    if (effect.removesPurple > 0) score += 6 * effect.removesPurple
    for (const grant of effect.cardGrants ?? effect.grants ?? []) {
      const def = cardById(grant.id)
      if (def) score += cardScore(def, store, strategy) * grant.count
    }
    for (const grant of effect.consumableGrants ?? []) score += 8 * grant.count
  }
  return score
}

function visitShop(store, act, strategy) {
  if (strategy === 'baseline') return
  for (let purchase = 0; purchase < 8; purchase++) {
    const offers = []
    const reserve = strategy === 'economy' && store.player.hp / store.effectivePlayer.maxHp > 0.5 ? 20 : 0
    const add = (action, slot, price, score) => {
      if (Number.isFinite(price) && price > 0 && price <= store.player.gold - reserve && score > 0) offers.push({ action, slot, score: score / price })
    }
    store.shopHeals.forEach((id, slot) => {
      const def = id && cardById(id)
      if (def && store.player.hp < store.effectivePlayer.maxHp * 0.75) add('BUY_SHOP_HEAL', slot, store.shopHealPrice(id), cardScore(def, store, strategy) * 2)
    })
    store.shopUpgrades.forEach((id, slot) => {
      const def = id && cardById(id)
      if (def && !def.effects.some(effect => effect.polarity === 'negative')) add('BUY_SHOP_UPGRADE', slot, upgradeCost(def), cardScore(def, store, strategy))
    })
    store.shopEquipment.forEach((id, slot) => {
      const eq = id && equipmentById(id)
      if (eq) add('BUY_SHOP_EQUIP', slot, equipCost(eq), equipmentScore(store, { ...store.player.equipment, [eq.slot]: id }, strategy) - equipmentScore(store, store.player.equipment, strategy))
    })
    store.shopConsumables.forEach((id, slot) => {
      const def = id && consumableById(id)
      if (!def || (store.consumableCounts[id] ?? 0) > 0 || def.effects.some(effect => effect.polarity === 'negative')) return
      const wanted = def.cleanse ? store.upgrades.some(card => card.def.cardClass === 'purple') : ['attack', 'corner'].includes(strategy) && ['tactical_potion', 'charge_potion', 'combo_scroll'].includes(id)
      if (wanted) add('BUY_SHOP_CONSUMABLE', slot, def.price, def.cleanse ? 30 : 12)
    })
    const offer = offers.sort((a, b) => b.score - a.score)[0]
    if (!offer) break
    const before = store.player.gold
    act(offer.action, [offer.slot], 'shop')
    if (before === store.player.gold) break
    bestEquipment(store, act, strategy)
  }
}
function useSupplies(store, act, strategy, usedThisRound) {
  if (strategy === 'baseline') return
  const purple = store.upgrades.find(card => canRemoveCard(card.def, 'cleanse'))
  if (purple && !store.consumableDisabledReason('cleanse_potion')) act('USE_CONSUMABLE', ['cleanse_potion', purple.def.id], 'consumable')
  if (store.screen !== 'battle' || store.battle?.phase !== 'playing' || !['corner', 'attack', 'defense'].includes(strategy)) return
  const key = `${store.stage}:${store.currentNodeId}:${store.battle.round}`
  if (usedThisRound.has(key) || store.battle.turnsUsed !== 0) return
  const priorities = strategy === 'defense' ? ['tactical_potion', 'combo_scroll'] : ['combo_scroll', 'charge_potion', 'tactical_potion']
  for (const id of priorities) if (!store.consumableDisabledReason(id)) {
    if (consumableById(id).duration === 'battle' && Object.keys(store.battle.battleModifiers ?? {}).length) continue
    act('USE_CONSUMABLE', [id], 'consumable')
    usedThisRound.add(key)
    break
  }
}

function effectiveStats(store) {
  const player = store.effectivePlayer
  const effects = computeEquipBonuses(store.player.equipment).setEffects
  return Object.fromEntries(['hp', 'maxHp', 'attackMultiplier', 'defenseMultiplier', 'flatAttack', 'flatDefense', 'baseSpeed', 'bonusTurns', 'goldBoost', 'xpBoost', 'spawnArmor'].map(key => [key, player[key] ?? 0]).concat([['maxTurns', store.battle?.maxTurns ?? player.baseMaxTurns + player.bonusTurns + effects.extraTurns]]))
}

/** Returns exact deterministic metrics and a non-hashed wall-clock performance
 * record. Invalid/stuck runs return terminal.valid=false (or throwOnFailure).
 * No simulation result should be interpreted as optimal or human play. */
export function runSim(seed = DEFAULT_SEED, inputOptions = {}) {
  if (!Number.isSafeInteger(seed)) throw new RangeError('seed must be a safe integer')
  const options = normalizeOptions(inputOptions)
  const started = performance.now()
  const activePinia = pinia.createPinia()
  pinia.setActivePinia(activePinia)
  const store = useGameStore(activePinia)
  const actions = {}, actionSources = {}, hpSources = {}, goldSources = {}, cardSources = {}, acquired = {}, removed = {}, rewardPicks = {}, consumablesUsed = {}
  const battleStats = { rounds: 0, settledRounds: 0, winningRounds: 0, losingRounds: 0, kills: 0, turns: 0, battles: 0, noLegalMoves: 0, invalidSlides: 0, earlyEnds: 0, zeroDamageRounds: 0, enemyDamage: 0, curseDamage: 0, moveSelfDamage: 0, healing: 0, damageDealt: 0, enemyHealing: 0, mergedSum: 0 }
  const nodesVisited = {}, roundsSeen = new Set(), battlesSeen = new Set(), usedThisRound = new Set()
  const recentActions = []
  let iterations = 0, failure = null, lastBattle = null, peakStats = {}, initialStats
  function sourceHp(source, healing, loss) {
    const entry = hpSources[source] ??= { healing: 0, loss: 0 }
    entry.healing += healing; entry.loss += loss
  }
  function act(action, args = [], source = action.toLowerCase()) {
    const hpBefore = store.player.hp, goldBefore = store.player.gold
    const beforeCounts = Object.fromEntries(store.upgrades.map(card => [card.def.id, card.count]))
    const turnsBefore = store.battle?.totalTurns ?? 0
    const roundBefore = store.battle?.round
    const instantDef = action === 'PICK_UPGRADE' ? store.rewardChoices.find(def => def.id === args[0]) : action === 'BUY_SHOP_HEAL' ? cardById(store.shopHeals[args[0]] ?? '') : null
    const rewardReason = store.rewardReason
    const rewardGeneration = store.rewardRollCount
    store[action](...args)
    increment(actions, action); increment(actionSources, source)
    recentActions.push(`${action}(${args.join(',')})`)
    if (recentActions.length > 12) recentActions.shift()
    if (action === 'PICK_UPGRADE' && (store.rewardRollCount !== rewardGeneration || store.screen !== 'reward')) increment(rewardPicks, rewardReason)
    if (instantDef?.kind === 'instant' && store.player.hp > hpBefore) {
      increment(acquired, instantDef.id)
      increment(cardSources[source] ??= {}, instantDef.id)
    }
    const afterCounts = Object.fromEntries(store.upgrades.map(card => [card.def.id, card.count]))
    for (const id of new Set([...Object.keys(beforeCounts), ...Object.keys(afterCounts)])) {
      const delta = (afterCounts[id] ?? 0) - (beforeCounts[id] ?? 0)
      if (delta > 0) { increment(acquired, id, delta); increment(cardSources[source] ??= {}, id, delta) }
      if (delta < 0) increment(removed, id, -delta)
    }
    if (action === 'USE_CONSUMABLE') increment(consumablesUsed, args[0])
    const goldDelta = store.player.gold - goldBefore
    const goldEntry = goldSources[source] ??= { gained: 0, spent: 0 }
    if (goldDelta >= 0) goldEntry.gained += goldDelta
    else goldEntry.spent -= goldDelta
    const battle = store.battle
    const advanced = action === 'SLIDE' && battle && (battle.totalTurns ?? 0) > turnsBefore
    if (advanced) {
      battleStats.turns += (battle.totalTurns ?? 0) - turnsBefore
      battleStats.mergedSum += battle.lastMergedSum ?? 0
    } else if (action === 'SLIDE') battleStats.invalidSlides++
    const moveLoss = advanced ? Math.min(hpBefore, battle.lastMoveDamage ?? 0) : 0
    if (moveLoss) { sourceHp('move_recoil', 0, moveLoss); battleStats.moveSelfDamage += moveLoss }
    const roundKey = `${store.stage}:${store.currentNodeId}:${roundBefore}`
    const lethalMove = moveLoss >= hpBefore && hpBefore > 0
    const settled = ['SLIDE', 'END_TURN_EARLY'].includes(action) && battle?.lastRoundResult && !roundsSeen.has(roundKey) && !lethalMove
    if (settled) {
      roundsSeen.add(roundKey)
      const result = battle.lastRoundResult
      const healing = result.healing ?? 0
      const actualLoss = Math.max(0, hpBefore - moveLoss + healing - store.player.hp)
      const curse = Math.min(actualLoss, result.curseDamage ?? 0)
      sourceHp('combat', healing, actualLoss - curse)
      sourceHp('round_curse', 0, curse)
      battleStats.settledRounds++
      battleStats.enemyDamage += actualLoss - curse
      battleStats.curseDamage += curse
      battleStats.healing += healing
      battleStats.damageDealt += (result.enemyDamage ?? 0) + (result.extraDamage ?? 0) + (result.reflectedDamage ?? 0)
      battleStats.enemyHealing += result.enemyHealing ?? 0
      if (!(result.enemyDamage > 0 || result.extraDamage > 0 || result.reflectedDamage > 0)) battleStats.zeroDamageRounds++
    } else if (!moveLoss && !['SLIDE', 'END_TURN_EARLY'].includes(action)) {
      sourceHp(source, Math.max(0, store.player.hp - hpBefore), Math.max(0, hpBefore - store.player.hp))
    }
    const stats = effectiveStats(store)
    for (const [key, value] of Object.entries(stats)) peakStats[key] = Math.max(peakStats[key] ?? value, value)
  }
  try {
    store.START_RUN(seed)
    if (options.syntheticStage !== null) {
      store.stage = options.syntheticStage
      store.route = generateRoute(createScopedRng(seed, 'synthetic-route', store.stage), store.stage)
      store.currentNodeId = null
      // START_RUN already uses a clean meta state; no debug action is enabled.
    }
    initialStats = effectiveStats(store)
    peakStats = { ...initialStats }
    while (iterations < options.maxIterations && !failure) {
      if (store.screen === 'gameover') break
      iterations++
      if (battleStats.turns >= options.maxValidTurns) { failure = { code: 'turn_limit', detail: `Reached ${options.maxValidTurns} valid turns` }; break }
      bestEquipment(store, act, options.strategy)
      useSupplies(store, act, options.strategy, usedThisRound)
      switch (store.screen) {
        case 'route': {
          // 重入是玩家的可选动作；机器人始终向前推进，跳过自己所在的节点防止来回打转。
          const available = store.route.filter(node => node.accessible && !node.completed && node.id !== store.currentNodeId)
          const node = options.strategy === 'baseline' ? available[0] : available.sort((a, b) => routeScore(b, store, options.strategy) - routeScore(a, store, options.strategy))[0]
          if (!node) { failure = { code: 'route_no_accessible_node', detail: 'No uncompleted accessible route node; not a terminal run' }; break }
          increment(nodesVisited, node.type)
          act('SELECT_NODE', [node.id], 'route')
          break
        }
        case 'battle': {
          const battle = store.battle
          if (!battle) { failure = { code: 'missing_battle', detail: 'battle screen without battle state' }; break }
          if (battle.round > options.maxBattleRounds) { failure = { code: 'battle_round_limit', detail: `Round ${battle.round} exceeds ${options.maxBattleRounds}` }; break }
          if (battle.phase === 'playing') {
            if (battle.maxTurns <= battle.turnsUsed) { failure = { code: 'zero_action_budget', detail: `playing turnsUsed=${battle.turnsUsed} maxTurns=${battle.maxTurns}` }; break }
            const direction = chooseDirection(battle.grid, battle.turnsUsed, options.strategy)
            let early = !direction
            if (options.strategy !== 'baseline' && direction) {
              const preview = getBattlePreview(battle, store.cardPlayer)
              early = preview.playerFirst && preview.enemyDamage >= battle.enemyCurrentHp
            }
            if (early) {
              if (!direction) battleStats.noLegalMoves++
              battleStats.earlyEnds++
              act('END_TURN_EARLY', [], 'combat')
              if (store.battle?.phase === 'playing') failure = { code: 'early_end_no_progress', detail: 'END_TURN_EARLY did not settle a round' }
            } else {
              act('SLIDE', [direction], 'combat')
              if (store.battle?.phase === 'playing' && store.battle.turnsUsed === battle.turnsUsed) failure = { code: 'valid_slide_no_progress', detail: `Predicted legal ${direction} did not consume a turn` }
            }
          } else if (battle.phase === 'round_delay') act('SHOW_ROUND', [], 'presentation')
          else if (battle.phase === 'round_end') act('NEXT_ROUND', [], 'round_start')
          else if (battle.phase === 'finish_delay') {
            const key = `${store.stage}:${store.currentNodeId}`
            if (!battlesSeen.has(key)) {
              battlesSeen.add(key); battleStats.battles++; battleStats.rounds += battle.round
              if (battle.result?.playerWon) { battleStats.kills++; battleStats.winningRounds += battle.round }
              else battleStats.losingRounds += battle.round
              lastBattle = { stage: store.stage, nodeId: store.currentNodeId, enemyId: battle.enemy.id, round: battle.round, phase: battle.phase, playerHp: store.player.hp, enemyHp: battle.enemyCurrentHp, turnsUsed: battle.turnsUsed, maxTurns: battle.maxTurns, cardModifiers: clone(battle.cardModifiers), roundModifiers: clone(battle.roundModifiers ?? {}), battleModifiers: clone(battle.battleModifiers ?? {}), result: clone(battle.result), lastRoundResult: clone(battle.lastRoundResult) }
            }
            act('SHOW_BATTLE_RESULT', [], 'presentation')
          } else if (battle.phase === 'finished') {
            if (lastBattle) lastBattle.phase = 'finished'
            act('END_BATTLE', [options.strategy === 'economy' ? 'gold' : options.strategy === 'baseline' ? undefined : 'xp'], 'overflow')
          } else failure = { code: 'unknown_battle_phase', detail: String(battle.phase) }
          break
        }
        case 'reward': {
          const choices = store.rewardChoices.filter(def => !def.effects.some(effect => effect.polarity === 'negative') && (def.kind !== 'instant' || store.player.hp < store.effectivePlayer.maxHp))
          const chosen = options.strategy === 'baseline' ? choices[0] : choices.sort((a, b) => cardScore(b, store, options.strategy) - cardScore(a, store, options.strategy))[0]
          const generation = store.rewardRollCount
          const beforeQueue = JSON.stringify(store.rewardQueue)
          if (chosen) act('PICK_UPGRADE', [chosen.id, generation], `reward_${store.rewardReason}`)
          else act('SKIP_REWARD', [generation], 'reward_skip')
          if (store.screen === 'reward' && store.rewardRollCount === generation && JSON.stringify(store.rewardQueue) === beforeQueue) failure = { code: 'reward_no_progress', detail: `Card ${chosen?.id ?? 'skip'} did not consume real queued reward` }
          break
        }
        case 'shop':
          visitShop(store, act, options.strategy)
          act('GO_TO_ROUTE', [], 'shop_leave')
          break
        case 'rest': {
          // 营地只治疗；紫卡改由净化药剂或奇遇移除。
          if (!store.restUsed) act('REST_HEAL', [], 'rest')
          act('GO_TO_ROUTE', [], 'rest_leave')
          if (store.screen === 'rest') failure = { code: 'rest_no_progress', detail: 'Rest remained unused or could not leave' }
          break
        }
        case 'event': {
          if (!store.gameEvent) { failure = { code: 'missing_event', detail: 'event screen without gameEvent' }; break }
          if (!store.eventResult) {
            const choices = store.gameEvent.choices.map((choice, index) => ({ ...choice, index })).filter(choice => !store.eventChoiceDisabledReason(choice.index) && (options.allowNegativeEvents || !eventHasNegative(choice.effect)))
            const chosen = choices.sort((a, b) => eventScore(b.effect, store, options.strategy) - eventScore(a.effect, store, options.strategy))[0]
            if (!chosen) { failure = { code: 'event_no_safe_choice', detail: `No allowed enabled choice in ${store.gameEvent.id}` }; break }
            act('RESOLVE_EVENT', [chosen.index], 'event_preview')
            if (!store.eventResult) failure = { code: 'event_resolve_no_progress', detail: `Cannot resolve ${store.gameEvent.id} choice ${chosen.index}` }
          } else {
            if (!options.allowNegativeEvents && eventHasNegative(store.eventResult.effect)) { failure = { code: 'unexpected_negative_event', detail: 'Resolved negative result from policy-approved safe choice' }; break }
            const black = store.eventResult.requiresBlackConfirmation || (store.eventResult.effect.cardGrants ?? []).some(grant => cardById(grant.id)?.cardClass === 'black')
            if (black) act('CONFIRM_BLACK_EVENT', [], 'event_confirm')
            act('APPLY_EVENT', [], 'event')
            if (store.screen === 'event') failure = { code: 'event_apply_no_progress', detail: `Could not apply cached result in ${store.gameEvent.id}` }
          }
          break
        }
        case 'boss_choice': act('BOSS_DEFEATED', [store.stage < options.maxStage ? 'continue' : 'end'], 'boss'); break
        default: failure = { code: 'unexpected_screen', detail: store.screen }
      }
    }
    if (!failure && store.screen !== 'gameover') failure = { code: 'iteration_limit', detail: `Reached ${options.maxIterations} iterations on ${store.screen}` }
    if (!failure && (!store.runOutcome || (store.runOutcome === 'defeat' && store.player.hp !== 0))) failure = { code: 'invalid_terminal', detail: `outcome=${store.runOutcome} hp=${store.player.hp}` }
    if (!failure && (store.battle || store.rewardQueue.length || store.rewardChoices.length || store.pendingLevels)) failure = { code: 'terminal_pending_state', detail: 'gameover retained a battle or pending reward' }
  } catch (error) {
    failure = { code: 'exception', detail: error.stack ?? String(error) }
  }
  const cards = store.upgrades.map(card => ({ id: card.def.id, cardClass: card.def.cardClass, kind: card.def.kind, count: card.count })).sort((a, b) => a.id.localeCompare(b.id, 'en'))
  const classCounts = Object.fromEntries(CLASSES.map(cardClass => [cardClass, cards.filter(card => card.cardClass === cardClass).reduce((sum, card) => sum + card.count, 0)]))
  const hpHealing = Object.values(hpSources).reduce((sum, entry) => sum + entry.healing, 0)
  const hpLoss = Object.values(hpSources).reduce((sum, entry) => sum + entry.loss, 0)
  const goldGained = Object.values(goldSources).reduce((sum, entry) => sum + entry.gained, 0)
  const goldSpent = Object.values(goldSources).reduce((sum, entry) => sum + entry.spent, 0)
  const snapshot = {
    ruleVersion: RULE_VERSION, policyVersion: POLICY_VERSION, ruleFingerprint: getRuleFingerprint(), seed, options,
    scenario: options.syntheticStage === null ? 'normal fresh-meta run' : `SYNTHETIC stage-${options.syntheticStage} fresh-player fixture; not evidence of playable reachability`,
    stagesCleared: Math.max(0, store.runOutcome === 'victory' ? store.stage - (options.syntheticStage ?? 1) + 1 : store.stage - (options.syntheticStage ?? 1)),
    screen: store.screen, iterations,
    terminal: { valid: !failure, failure, outcome: store.runOutcome, screen: store.screen, stage: store.stage, nodeId: store.currentNodeId, phase: store.battle?.phase ?? null, enemyId: store.battle?.enemy.id ?? null, round: store.battle?.round ?? null, lastBattle, rewardQueue: clone(store.rewardQueue), rewardChoices: store.rewardChoices.map(def => def.id), pendingLevels: store.pendingLevels, eventPending: !!store.eventResult, debugActionCount: store.debugActionCount, recentActions: failure ? recentActions : [] },
    player: clone(store.player), stats: { initial: initialStats ?? {}, terminal: effectiveStats(store), peak: peakStats },
    cards, cardCounts: { total: cards.reduce((sum, card) => sum + card.count, 0), unique: cards.length, byClass: classCounts, acquired: ordered(acquired), removed: ordered(removed), sources: ordered(cardSources) },
    upgradeIds: cards.map(card => card.id), cardModifiers: clone(store.cardModifiers),
    inventory: { equipmentIds: [...store.player.inventory].sort(), equipped: clone(store.player.equipment), consumables: ordered(store.consumableCounts), consumed: ordered(consumablesUsed) },
    hp: { initial: initialStats?.hp ?? 100, terminal: store.player.hp, healing: hpHealing, loss: hpLoss, accountingResidual: (initialStats?.hp ?? 100) + hpHealing - hpLoss - store.player.hp, sources: ordered(hpSources) },
    gold: { initial: 0, terminal: store.player.gold, gained: goldGained, spent: goldSpent, accountingResidual: goldGained - goldSpent - store.player.gold, sources: ordered(goldSources) },
    meta: clone(store.meta), battleStats, nodesVisited: ordered(nodesVisited), actions: ordered(actions), actionSources: ordered(actionSources), rewardPicks: ordered(rewardPicks),
  }
  if (!failure && (snapshot.hp.accountingResidual !== 0 || snapshot.gold.accountingResidual !== 0)) {
    snapshot.terminal.valid = false
    snapshot.terminal.failure = { code: 'accounting_mismatch', detail: `hp=${snapshot.hp.accountingResidual} gold=${snapshot.gold.accountingResidual}` }
  }
  const elapsedMs = performance.now() - started
  const result = { snapshot, hash: digest(snapshot), iterations, battleStats, performance: { elapsedMs, iterationsPerSecond: elapsedMs ? iterations * 1000 / elapsedMs : 0 } }
  // Dispose reactive scopes between seeds; no persistent meta is carried over.
  store.$dispose()
  activePinia._e.stop()
  if (inputOptions.throwOnFailure && !snapshot.terminal.valid) {
    const error = new Error(`Simulation failed seed=${seed}: ${snapshot.terminal.failure.code}: ${snapshot.terminal.failure.detail}`)
    error.result = result
    throw error
  }
  return result
}

export function parseCli(argv) {
  const options = {}, extra = { mode: 'check', seed: DEFAULT_SEED, seeds: 200, seedStart: 1, holdoutStart: 301, holdoutCount: 50, policies: [...STRATEGIES], json: false, smoke: false }
  const numeric = { '--seed': [extra, 'seed'], '--seeds': [extra, 'seeds'], '--seed-start': [extra, 'seedStart'], '--holdout-start': [extra, 'holdoutStart'], '--holdout-count': [extra, 'holdoutCount'], '--max-stage': [options, 'maxStage'], '--max-iterations': [options, 'maxIterations'], '--max-battle-rounds': [options, 'maxBattleRounds'], '--max-valid-turns': [options, 'maxValidTurns'], '--synthetic-stage': [options, 'syntheticStage'] }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg in numeric) {
      const [target, key] = numeric[arg], value = Number(argv[++index])
      if (!Number.isSafeInteger(value)) throw new RangeError(`Missing/invalid integer for ${arg}`)
      target[key] = value
    } else if (arg === '--strategy') options.strategy = argv[++index]
    else if (arg === '--policies') extra.policies = (argv[++index] ?? '').split(',')
    else if (arg === '--allow-negative-events') options.allowNegativeEvents = true
    else if (arg === '--json') extra.json = true
    else if (arg === '--smoke') extra.smoke = true
    else if (arg === '--update-baseline' || arg === 'record') extra.mode = 'record'
    else if (arg === '--report-only' || arg === 'report') extra.mode = 'report'
    else if (arg === 'check' || arg === 'after' || arg === 'before') extra.mode = 'check'
    else throw new Error(`Unknown argument ${arg}`)
  }
  for (const key of ['seeds', 'seedStart', 'holdoutStart', 'holdoutCount']) if (!Number.isSafeInteger(extra[key]) || extra[key] < (key === 'holdoutCount' ? 0 : 1)) throw new RangeError(`${key} out of range`)
  if (extra.policies.some(policy => !STRATEGIES.includes(policy)) || !extra.policies.length || new Set(extra.policies).size !== extra.policies.length) throw new RangeError('Policies must be distinct known strategies')
  return { ...extra, options: normalizeOptions(options) }
}

export function baselinePath(kind, configuration) {
  const tag = digest(configuration).slice(0, 12)
  return path.join(BASELINE_DIRECTORY, `${RULE_VERSION}-${kind}-${configuration.options?.strategy ?? 'strategies'}-${tag}.json`)
}
export function historicalData() {
  return ['baseline.snapshot.json', 'parity-before.json', 'parity-after.json'].map(name => {
    const bytes = fs.readFileSync(path.join(import.meta.dirname, name))
    return { name, sha256: createHash('sha256').update(bytes).digest('hex'), data: JSON.parse(bytes.toString('utf8')) }
  })
}
export function validateOrRecord(file, anchor, mode) {
  if (mode === 'report') return { status: 'report-only', file }
  if (mode === 'record') {
    fs.mkdirSync(BASELINE_DIRECTORY, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(anchor, null, 2) + '\n', 'utf8')
    return { status: 'recorded', file }
  }
  if (!fs.existsSync(file)) return { status: 'missing', file, detail: 'No sixcolor baseline for these exact options. Review report, then explicitly record after integration is final.' }
  return { status: JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) === JSON.stringify(anchor) ? 'pass' : 'mismatch', file }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cli = parseCli(process.argv.slice(2))
  const historical = historicalData() // Always read/preserve old anchors before recording a new one.
  const result = runSim(cli.seed, cli.options)
  const repeated = runSim(cli.seed, cli.options)
  const deterministic = result.hash === repeated.hash
  const configuration = { seed: cli.seed, options: cli.options }
  const anchor = { ruleVersion: RULE_VERSION, policyVersion: POLICY_VERSION, configuration, hash: result.hash, snapshot: result.snapshot, historicalFiles: historical.map(({ name, sha256 }) => ({ name, sha256 })) }
  const validation = result.snapshot.terminal.valid && deterministic ? validateOrRecord(baselinePath('snapshot', configuration), anchor, cli.mode) : { status: 'invalid-not-recorded' }
  if (cli.json) console.log(JSON.stringify({ ...result, deterministic, validation }, null, 2))
  else {
    const s = result.snapshot
    console.log(`${RULE_VERSION} ${s.options.strategy}; ${s.scenario}`)
    console.log(`Seed ${cli.seed}: ${s.terminal.outcome ?? 'INVALID'} stage=${s.terminal.stage} cleared=${s.stagesCleared} screen=${s.screen} phase=${s.terminal.phase ?? 'null'} valid=${s.terminal.valid}`)
    console.log(`Player hp=${s.player.hp}/${s.stats.terminal.maxHp} gold=${s.player.gold} xp=${s.player.xp} level=${s.player.level}; cards=${s.cardCounts.total} ${JSON.stringify(s.cardCounts.byClass)}`)
    console.log(`Battle rounds=${s.battleStats.rounds} kills=${s.battleStats.kills} validTurns=${s.battleStats.turns} noLegalMoves=${s.battleStats.noLegalMoves} invalidSlides=${s.battleStats.invalidSlides}`)
    console.log(`HP loss=${s.hp.loss} heal=${s.hp.healing}; gold gained=${s.gold.gained} spent=${s.gold.spent}; inventory=${s.inventory.equipmentIds.length} consumables=${JSON.stringify(s.inventory.consumables)}`)
    console.log(`Iterations=${result.iterations}; elapsedMs=${result.performance.elapsedMs.toFixed(2)}; repeat=${deterministic ? 'PASS' : 'FAIL'}; SHA-256=${result.hash}`)
    console.log(`Baseline ${validation.status}: ${validation.file ?? ''}`)
    if (s.terminal.failure) console.error(JSON.stringify(s.terminal.failure))
    if (validation.detail) console.log(validation.detail)
    console.log('Historical anchors preserved; intentional redesign is not judged by the old 15% threshold. Algorithm rates are not human win rates.')
  }
  if (!result.snapshot.terminal.valid || !deterministic || ['missing', 'mismatch'].includes(validation.status)) process.exitCode = 1
}
