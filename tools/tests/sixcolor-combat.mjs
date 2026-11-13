import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { loadProject } from '../harness.mjs'

const combat = loadProject('./core/battle')
const equipment = loadProject('./core/equipment')
const cards = loadProject('./core/cardEffects')
const random = loadProject('./core/random')
const noRng = () => assert.fail('Operation must not consume RNG')
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)
function grid(values = []) {
  return Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, col) => ({
    value: values[row * 4 + col] ?? 0, id: row * 4 + col + 1, isNew: false, isMerged: false,
  })))
}
function player(overrides = {}) {
  return {
    hp: 80, maxHp: 100, attackMultiplier: 1, defenseMultiplier: 1,
    flatAttack: 0, flatDefense: 0, bonusTurns: 0, baseMaxTurns: 6,
    spawnArmor: 0, goldBoost: 0, xpBoost: 0, baseSpeed: 3,
    equipment: {}, inventory: [], gold: 0, xp: 0, level: 1, xpToNext: 25,
    ...overrides,
  }
}
function battle(overrides = {}) {
  const enemy = { id: 'test', name: '测试', hp: 200, maxHp: 200, attack: 20, defense: 0, speed: 0, tier: 1, ...overrides.enemy }
  return {
    grid: grid(), turnsUsed: 0, maxTurns: 6, totalAttack: 20, totalDefense: 0,
    enemyCurrentHp: enemy.hp, phase: 'playing', result: null, round: 1,
    lastRoundResult: null, savedSteps: 0, fortifyUsed: false,
    comboStreak: 0, mergeCount: 0, mechanicArmor: 0, carryArmor: 0,
    ...overrides, enemy,
  }
}
function sequence(...values) {
  let calls = 0
  const rng = () => {
    assert.ok(calls < values.length, `Unexpected RNG call ${calls + 1}`)
    return values[calls++]
  }
  Object.defineProperty(rng, 'calls', { get: () => calls })
  return rng
}
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

function checkStartingCredit() {
  const rng = sequence(0, 0, 0)
  const placed = combat.placeStartingPoints(grid(), 1000, () => 0)
  assert.equal(placed.pending, 0)
  assert.equal(placed.placed, 1000)
  assert.deepEqual(placed.grid.flat().filter(cell => cell.value).map(cell => cell.value), [512, 256, 128, 64, 32, 8])
  const oneSpace = grid(Array.from({ length: 16 }, (_, i) => i === 15 ? 0 : 2))
  const first = combat.placeStartingPoints(oneSpace, 1000, rng)
  assert.equal(first.placed, 512)
  assert.equal(first.pending, 488)
  assert.equal(rng.calls, 1)
  assert.deepEqual(combat.placeStartingPoints(first.grid, first.pending, noRng), { grid: first.grid, pending: 488, placed: 0 })
  assert.equal(combat.placeStartingPoints(grid(), 0, noRng).placed, 0)
  for (const invalid of [-2, 1, 2.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, 2 ** 53]) {
    assert.throws(() => combat.placeStartingPoints(grid(), invalid, noRng), /非负偶数安全整数/)
  }
  const huge = combat.placeStartingPoints(grid(), 2 ** 52, sequence(0))
  assert.equal(huge.grid[0][0].value, 2 ** 52)
  assert.equal(huge.pending, 0)
  const nearLimit = combat.placeStartingPoints(grid(), Number.MAX_SAFE_INTEGER - 1, () => 0)
  assert.equal(nearLimit.placed + nearLimit.pending, Number.MAX_SAFE_INTEGER - 1)
  assert.ok(nearLimit.pending > 0, '16 board spaces limit placement, not credit entitlement')

  const init = combat.initBattle(battle().enemy, 9, random.createRng(4), 2000, { startingPoints: 2000 })
  assert.equal(init.startingPointsGranted, 2000, 'explicit argument grants once, snapshot is not applied twice')
  assert.equal(init.startingPointsPlaced + init.startingPointsPending, init.startingPointsGranted)
  const full = battle({
    grid: grid(Array(16).fill(2)), startingPointsPending: 1000,
    startingPointsGranted: 1000, startingPointsPlaced: 0,
  })
  const next = combat.startNewRound(full, noRng, 1000)
  assert.equal(next.startingPointsPending, 2000)
  assert.equal(next.startingPointsGranted, 2000)
  const moved = combat.processTurn(next, 'left', () => 0)
  assert.equal(moved.startingPointsPending, 0, 'a merge move drains previously full-board credit')
  assert.equal(moved.startingPointsPlaced, 2000)
  assert.equal(moved.startingPointsPlaced + moved.startingPointsPending, moved.startingPointsGranted)
  assert.equal(new Set(moved.grid.flat().map(cell => cell.id)).size, 16, 'placement preserves unique board IDs')
  assert.throws(() => combat.startNewRound({ ...full, startingPointsPending: Number.MAX_SAFE_INTEGER - 1, startingPointsGranted: Number.MAX_SAFE_INTEGER - 1 }, noRng, 2), RangeError)
}

function checkMergeMechanics() {
  const source = freeze(battle({
    grid: grid([2, 2, 2, 2]), totalAttack: 0,
    cardModifiers: { mergeCoefficient: 0.5, burstCoefficient: 1, comboBonus: 3, mergeArmor: 0.25, soulRecoil: 2 },
  }))
  const first = combat.processTurn(source, 'left', sequence(0.99, 0))
  assert.equal(first.lastMergedSum, 8)
  assert.equal(first.totalAttack, 27, 'burst multiplies base earned charge, not flat combo')
  assert.equal(first.comboStreak, 1)
  assert.equal(first.mergeCount, 1, 'multiple tile merges count as one successful merging move')
  assert.equal(first.mechanicArmor, 2)
  assert.equal(combat.getMoveSelfDamage(first), 2)
  assert.equal(source.totalAttack, 0)
  const second = combat.processTurn(first, 'left', sequence(0.99, 0))
  assert.equal(second.lastMergedSum, 8)
  assert.equal(second.totalAttack, 57)
  assert.equal(second.comboStreak, 2)
  assert.equal(second.mergeCount, 2)
  const shifted = combat.processTurn({ ...second, grid: grid([2]) }, 'right', sequence(0, 0))
  assert.equal(shifted.comboStreak, 0)
  assert.equal(shifted.mergeCount, 2)
  assert.equal(shifted.lastMergedSum, 0)
  assert.equal(combat.getMoveSelfDamage(shifted), 0)
  assert.equal(shifted.totalAttack, 57)
  const ordinary = combat.processTurn(battle({ grid: grid([2, 2]), totalAttack: 0 }), 'left', sequence(0, 0))
  assert.equal(ordinary.mechanicArmor, 0, 'no golden merge-armor unlock means no earned mechanic armor')
  const loss = combat.processTurn(battle({ grid: grid([2, 2]), totalAttack: 0, cardModifiers: { chargeLoss: 1000 } }), 'left', sequence(0, 0))
  close(loss.totalAttack, 4 / 1001)
  const high = combat.processTurn(battle({ grid: grid([2, 2]), totalAttack: 0, cardModifiers: { mergeCoefficient: 1000, burstCoefficient: 1000, soulRecoil: 2000 } }), 'left', sequence(0, 0))
  assert.equal(high.totalAttack, 4 * 1001 * 1001)
  assert.equal(high.lastMoveDamage, 2000)
}

function checkArmorAndTemporaryModifiers() {
  const source = freeze(battle({
    grid: grid([2, 4, 8, 16]), totalDefense: 12, mechanicArmor: 1.25, carryArmor: 0.5,
    cardModifiers: { spawnArmor: 0.25, armorCarry: 1000, attackBonus: 1000, defenseBonus: 1000 },
    roundModifiers: { spawnArmor: 0.1, comboBonus: 2 },
    battleModifiers: { spawnArmor: 0.15, comboBonus: 1 },
  }))
  const combined = combat.getCombinedCardModifiers(source)
  assert.deepEqual(Object.keys(combined).sort(), Object.keys(cards.emptyCardModifiers()).sort())
  assert.equal(combined.spawnArmor, 0.5)
  assert.equal(combined.comboBonus, 3)
  const p = freeze(player({ defenseMultiplier: 1.2, spawnArmor: 0.2, flatDefense: 4 }))
  const preview = combat.getBattlePreview(source, p)
  assert.equal(preview.defenseValue, 22, 'float components are summed before a single armor floor (board 30 × 1.2 ÷ 3 = 12)')
  assert.equal(preview.playerDamage, 8, 'ceil(20 * 15 / (15 + 22 + 4)) uses scale 15')
  assert.equal(preview.enemyDamage, 20, 'white stats already derived by main, not reapplied from card snapshot')
  const next = combat.startNewRound(source, noRng)
  close(next.carryArmor, 1.75 * 1000 / 1001)
  assert.equal(next.mechanicArmor, 0)
  assert.equal(next.comboStreak, 0)
  assert.equal(next.mergeCount, 0)
  assert.deepEqual(next.roundModifiers, {})
  assert.deepEqual(next.battleModifiers, source.battleModifiers)
  assert.deepEqual(next.cardModifiers, source.cardModifiers)
  const after = combat.startNewRound(next, noRng)
  close(after.carryArmor, next.carryArmor * 1000 / 1001)
  assert.ok(after.carryArmor < next.carryArmor, 'unearned carry decays every round')
  assert.equal(combat.startNewRound(battle({ mechanicArmor: 100, carryArmor: 50 }), noRng).carryArmor, 0)
  assert.equal(combat.getBattlePreview(battle(), player({ flatDefense: 1e12, spawnArmor: 1000 })).playerDamage, 1, 'ordinary positive enemy attack never reaches zero')
  assert.equal(combat.getBattlePreview(battle({ enemy: { attack: 1 }, equipEffects: { enemyAtkDown: 0.3 } }), player()).playerDamage, 1, 'equipment weakening cannot round a positive base attack to zero')
  assert.equal(combat.getBattlePreview(battle({ enemy: { attack: 0 } }), player()).playerDamage, 0, 'an explicitly zero base enemy attack stays zero')
  assert.equal(equipment.getEffectivePlayer(player({ spawnArmor: 1000.25 })).spawnArmor, 1000.25)
  const vulnerable = combat.getBattlePreview(battle({ cardModifiers: { vulnerability: 0.3 } }), player({ flatDefense: 30 }))
  assert.equal(vulnerable.playerDamage, 10, 'ceil(ceil(20 * 15 / (15 + 30)) * 1.3): vulnerability scales after armor')
  const inactive = combat.resolveRound(battle({ totalAttack: 0, equipEffects: { regen: 0.16, lifesteal: 1 }, cardModifiers: { extraStrikeRating: 1000 } }), player({ flatAttack: 999 }), noRng)
  assert.equal(inactive.attackCount, 0)
  assert.equal(inactive.enemyDamage, 0)
  assert.equal(inactive.healing, 0, 'no activity cannot attack or regenerate')
  const merged = combat.resolveRound(battle({ mergeCount: 1, equipEffects: { regen: 0.08 } }), player(), noRng)
  assert.equal(merged.healing, 8, 'original holy percentage remains on a successful-merge round')
}

function checkRedAndCurses() {
  const red = combat.resolveRound(battle({ cardModifiers: { lifestealRating: 0.5, bleed: 3 } }), player(), noRng)
  assert.equal(red.healing, 6)
  assert.equal(red.curseDamage, 3)
  assert.equal(red.playerHpAfter, 63)
  assert.equal(red.enemyHpAfter, 180, 'red bleed damages player, not enemy')
  const capped = combat.resolveRound(battle({ enemyCurrentHp: 3, totalAttack: 100, equipEffects: { lifesteal: 0.2 }, cardModifiers: { lifestealRating: 1000 } }), player({ hp: 50 }), noRng)
  assert.equal(capped.healing, 3, 'combined lifesteal never exceeds actual hit HP damage')
  const penalized = combat.resolveRound(battle({ mergeCount: 1, equipEffects: { regen: 0.1, lifesteal: 1 }, cardModifiers: { healingPenalty: 1 } }), player(), noRng)
  assert.equal(penalized.healing, 15, 'every heal receives natural healing penalty')
  const extraRng = sequence(0)
  const extra = combat.resolveRound(battle({ cardModifiers: { extraStrikeRating: 1000, backlash: 4 } }), player(), extraRng)
  assert.equal(extra.attackCount, 2)
  assert.equal(extra.enemyDamage, 20)
  assert.equal(extra.extraDamage, 20)
  assert.equal(extra.curseDamage, 4)
  assert.equal(extra.enemyHpAfter, 160)
  assert.equal(extra.playerHpAfter, 56)
  assert.equal(extraRng.calls, 1, '1000 layers still roll one extra strike only')
  const noExtra = combat.resolveRound(battle({ cardModifiers: { extraStrikeRating: 1, backlash: 4000 } }), player(), sequence(0.75))
  assert.equal(noExtra.attackCount, 1)
  assert.equal(noExtra.curseDamage, 0, 'backlash requires actual extra-strike trigger')
  const firstKill = combat.resolveRound(battle({ enemyCurrentHp: 1, cardModifiers: { extraStrikeRating: 1000, backlash: 4 } }), player(), noRng)
  assert.equal(firstKill.attackCount, 1)
  assert.equal(firstKill.curseDamage, 0)
  const extraKill = combat.resolveRound(battle({ enemyCurrentHp: 21, cardModifiers: { extraStrikeRating: 1, backlash: 4, enemyRegen: 4 } }), player(), sequence(0))
  assert.equal(extraKill.extraDamage, 1)
  assert.equal(extraKill.enemyHpAfter, 0)
  assert.equal(extraKill.enemyHealing, 0, 'extra-strike kill cannot be revived by black regeneration')
  const lethalBacklash = combat.resolveRound(battle({ cardModifiers: { extraStrikeRating: 1000, backlash: 4 } }), player({ hp: 3 }), sequence(0))
  assert.equal(lethalBacklash.playerHpAfter, 0)
  assert.equal(lethalBacklash.curseDamage, 3, 'curse damage reports actual clamped HP loss')
  assert.equal(lethalBacklash.enemyActed, false, 'backlash death prevents later enemy action')
  const firstDeath = combat.resolveRound(battle({ enemy: { speed: 999 }, cardModifiers: { extraStrikeRating: 1000, lifestealRating: 1000, bleed: 3, burn: 2 }, equipEffects: { regen: 0.16 }, mergeCount: 1 }), player({ hp: 1 }), noRng)
  assert.equal(firstDeath.attackCount, 0)
  assert.equal(firstDeath.healing, 0)
  assert.equal(firstDeath.curseDamage, 0)
  const burnDeath = combat.resolveRound(battle({ enemyCurrentHp: 1, cardModifiers: { bleed: 3, burn: 2, enemyRegen: 4000 } }), player({ hp: 4 }), noRng)
  assert.equal(burnDeath.enemyHpAfter, 0)
  assert.equal(burnDeath.playerHpAfter, 0)
  assert.equal(burnDeath.curseDamage, 4, 'simultaneous kill/end-round curse death is returned for main death priority')
  assert.equal(burnDeath.enemyHealing, 0)
  const regen = combat.resolveRound(battle({ enemyCurrentHp: 180, cardModifiers: { enemyRegen: 4 } }), player(), noRng)
  assert.equal(regen.enemyHealing, 4)
  assert.equal(regen.enemyHpAfter, 164)
  const dead = combat.resolveRound(battle({ cardModifiers: { bleed: 3, burn: 2, extraStrikeRating: 1000, lifestealRating: 1000 } }), player({ hp: 0 }), noRng)
  assert.equal(dead.attackCount, 0)
  assert.equal(dead.curseDamage, 0)
  assert.equal(dead.healing, 0)
}

// 新机制：连锁回响 / 致命节奏 / 猎手印记 / 过载核心 / 蓄力起步 / 幸运生成 / 减半护佑 / 脆甲诅咒 / 阴影低语。
function checkNewMechanics() {
  // 连锁回响：未合并时连锁按自然分数保留；没有该卡时依旧归零。
  const graceBattle = battle({
    grid: grid([0, 2, 4, 8]), comboStreak: 5,
    cardModifiers: { comboGrace: 0.5 },
  })
  const graced = combat.processTurn(freeze(graceBattle), 'left', sequence(0.99, 0))
  assert.equal(graced.comboStreak, 1, 'combo grace keeps floor(5 × 0.5/1.5) = 1 without a merge')
  const plain = combat.processTurn(freeze(battle({ grid: grid([0, 2, 4, 8]), comboStreak: 5 })), 'left', sequence(0.99, 0))
  assert.equal(plain.comboStreak, 0, 'without the card a missed merge still resets the streak')

  // 致命节奏：暴击把本次攻击翻倍，吸血与溢出按倍后数值；未触发时与原公式一致。
  const critBattle = battle({
    totalAttack: 20, enemyCurrentHp: 500,
    cardModifiers: { critRating: 3 },
  })
  const critHit = combat.resolveRound(freeze(critBattle), freeze(player()), sequence(0.05, 0.99, 0.99))
  assert.equal(critHit.enemyDamage, 40, 'crit doubles the planned strike')
  assert.equal(critHit.healing, 0, 'no lifesteal without the rating')
  const critMiss = combat.resolveRound(freeze(critBattle), freeze(player()), sequence(0.95, 0.99, 0.99))
  assert.equal(critMiss.enemyDamage, 20, 'missed crit keeps the base strike')

  // 猎手印记：一击后敌人剩余生命低于斩杀线时直接击杀，补刀计入溢出。
  const executeBattle = battle({
    totalAttack: 20, enemyCurrentHp: 30,
    cardModifiers: { executeRating: 1 },
  })
  const executed = combat.resolveRound(freeze(executeBattle), freeze(player()), sequence(0.99, 0.99))
  assert.equal(executed.enemyHpAfter, 0, 'remaining 10 HP is below the 50% execute line')
  assert.equal(executed.enemyDamage, 20, 'reported strike stays the planned damage')
  assert.equal(executed.overflowDamage, 10, 'executed HP counts as overflow')

  // 过载核心 + 蓄力起步：剩余步数与固定蓄力转入下一回合开局。
  const carried = combat.startNewRound(
    freeze(battle({ totalAttack: 50, turnsUsed: 4, maxTurns: 6, cardModifiers: { savedStepsCharge: 2, chargeStart: 3 } })),
    sequence(0.99),
    0,
  )
  assert.equal(carried.savedSteps, 2, 'remaining steps recomputed at round start')
  assert.equal(carried.totalAttack, 7, '2 saved steps × 2 + 3 charge start')
  const plainRound = combat.startNewRound(freeze(battle({ turnsUsed: 4, maxTurns: 6 })), sequence(0.99), 0)
  assert.equal(plainRound.totalAttack, 0, 'without the cards a new round still starts at zero')

  // 幸运生成：四值概率随评级渐进；无卡时保持 10%。合并滑动仍只消耗位置 + 数值两次抽签。
  const luckyBattle = battle({ grid: grid([2, 2, 0, 0]), cardModifiers: { spawnLuck: 3 } })
  const luckyRng = sequence(0.99, 0.95)
  const lucky = combat.processTurn(freeze(luckyBattle), 'left', luckyRng)
  assert.equal(lucky.lastMergedSum, 4)
  assert.equal(luckyRng.calls, 2, 'spawn still consumes position + value rolls')

  // 减半护佑：命中保护的方块数值不变，未命中的照常减半。
  const shielded = combat.startNewRound(
    freeze(battle({ grid: grid([16, 0, 0, 0, 8]), cardModifiers: { halveShield: 3 } })),
    sequence(0.01, 0.99),
    0,
  )
  const shieldValues = shielded.grid.flat().map(cell => cell.value)
  assert.equal(shieldValues[0], 16, 'protected tile keeps its value')
  assert.equal(shieldValues[4], 4, 'unprotected tile halves')

  // 脆甲诅咒：侵蚀直接抵扣传承评级，可压到 0。
  const eroded = combat.startNewRound(
    freeze(battle({ mechanicArmor: 700, carryArmor: 700, cardModifiers: { armorCarry: 0.25, armorErosion: 0.25 } })),
    noRng,
    0,
  )
  assert.equal(eroded.carryArmor, 0, 'erosion cancels carry retention entirely')
  const kept = combat.startNewRound(
    freeze(battle({ mechanicArmor: 700, carryArmor: 700, cardModifiers: { armorCarry: 0.25, armorErosion: 0.15 } })),
    noRng,
    0,
  )
  assert.ok(Math.abs(kept.carryArmor - 1400 * (0.1 / 1.1)) < 1e-9, 'retention uses max(0, carry − erosion)')

  // 阴影低语：敌人攻击按回合数成长，只影响承伤不改动敌人本体。
  const ragePreview = combat.getBattlePreview(
    freeze(battle({ round: 4, cardModifiers: { enemyRage: 2 } })),
    freeze(player()),
  )
  assert.equal(ragePreview.enemyAttack, 20 + 2 * 3 + 3 * 2, 'rage adds 2 per round on top of buffered base growth (rounds 1-2 free)')
  const rageEnemy = battle({ round: 4, cardModifiers: { enemyRage: 2 } }).enemy
  assert.equal(rageEnemy.attack, 20, 'the enemy object itself is never mutated')

  // 浴血狂怒：每层“每损失10%生命攻击倍率+6个百分点”；满血无加成，承伤代价由易伤键结算。
  const fullHp = combat.getBattlePreview(battle({ totalAttack: 20, cardModifiers: { lowHpFury: 6 } }), player({ hp: 100, maxHp: 100 }))
  assert.equal(fullHp.enemyDamage, 20, 'full hp grants no fury bonus')
  const wounded = combat.getBattlePreview(battle({ totalAttack: 20, cardModifiers: { lowHpFury: 6 } }), player({ hp: 50, maxHp: 100 }))
  assert.equal(wounded.enemyDamage, 26, '50% missing hp → +0.30 multiplier (6% per 10% lost), exact halves avoid float tails')
  const nearDeath = combat.getBattlePreview(battle({ totalAttack: 20, cardModifiers: { lowHpFury: 6 } }), player({ hp: 1, maxHp: 100 }))
  assert.equal(nearDeath.enemyDamage, 31, '99% missing hp floors at the +0.594 multiplier bonus')
  const stacked = combat.getBattlePreview(battle({ totalAttack: 20, cardModifiers: { lowHpFury: 12 } }), player({ hp: 50, maxHp: 100 }))
  assert.equal(stacked.enemyDamage, 32, 'two layers stack linearly to +0.60 at half hp')
  const boostedCap = combat.getBattlePreview(battle({ totalAttack: 20, cardModifiers: { lowHpFury: 6 } }), player({ hp: 160, maxHp: 160 }))
  assert.equal(boostedCap.enemyDamage, 20, 'bonus tracks effective max hp: full hp still grants nothing')
}

export async function run() {
  const ambientRandom = Math.random
  Math.random = () => { throw new Error('Six-color combat must use explicit RNG') }
  try {
    checkStartingCredit()
    checkMergeMechanics()
    checkArmorAndTemporaryModifiers()
    checkRedAndCurses()
    checkNewMechanics()
  } finally {
    Math.random = ambientRandom
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run()
  console.log('PASS sixcolor-combat.mjs (credit, 1000 stacks, armor, red/curse timing, temporary modifiers)')
}
