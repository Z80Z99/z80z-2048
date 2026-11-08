// Equipment/combat regressions: typed set thresholds, deterministic items and chronological turns.
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { loadProject } from '../harness.mjs'

const equipment = loadProject('./core/equipment')
const combat = loadProject('./core/battle')
const random = loadProject('./core/random')
const SLOTS = ['pants', 'helmet', 'armor', 'gloves', 'boots']
const EMPTY_EFFECTS = {
  extraTurns: 0, lifesteal: 0, dodge: 0, skipChance: 0, fortify: false,
  firstStrike: false, doubleAtk: false, pierce: 0, doubleXp: false,
  doubleGold: false, regen: 0, reflect: 0, enemyAtkDown: 0, enemySpdDown: 0,
  attackBonus: 0, defenseBonus: 0, hpBonus: 0, speedBonus: 0, speedPercent: 0,
  goldBonus: 0, xpBonus: 0, halfDefense: false, dropRarityBoost: 0, dropCount: 1,
  randomBonus: 0, randomDouble: false,
}
const allStats = value => ({ attackBonus: value, defenseBonus: value, hpBonus: value, speedPercent: value })
// Independent cumulative expectations, not read from implementation effect definitions.
const SET_EXPECTATIONS = {
  tempest: [
    { speedBonus: 4 },
    { speedBonus: 4, attackBonus: 0.2 },
    { speedBonus: 4, attackBonus: 0.2, extraTurns: 2 },
  ],
  fortress: [
    { defenseBonus: 0.2 },
    { defenseBonus: 0.2, hpBonus: 0.25 },
    { defenseBonus: 0.2, hpBonus: 0.25, fortify: true, reflect: 5 },
  ],
  shadow: [
    { speedBonus: 3 },
    { speedBonus: 3, attackBonus: 0.1 },
    { speedBonus: 3, attackBonus: 0.1, firstStrike: true, dodge: 0.1 },
  ],
  vampire: [
    { attackBonus: 0.1 },
    { attackBonus: 0.1, lifesteal: 0.1 },
    { attackBonus: 0.35, lifesteal: 0.2 },
  ],
  treasure: [
    { goldBonus: 0.25 },
    { goldBonus: 0.25, xpBonus: 0.3 },
    { goldBonus: 0.25, xpBonus: 0.3, dropRarityBoost: 1 },
  ],
  flame: [
    { attackBonus: 0.15 },
    { attackBonus: 0.4 },
    { attackBonus: 0.4, pierce: 0.4 },
  ],
  frost: [
    { defenseBonus: 0.15 },
    { defenseBonus: 0.15, enemySpdDown: 4 },
    { defenseBonus: 0.15, enemySpdDown: 4, enemyAtkDown: 0.3 },
  ],
  thunder: [
    { speedBonus: 5 },
    { speedBonus: 5, attackBonus: 0.15 },
    { speedBonus: 5, attackBonus: 0.15, skipChance: 0.2 },
  ],
  holy: [
    { hpBonus: 0.2 },
    { hpBonus: 0.2, regen: 0.08 },
    { hpBonus: 0.2, regen: 0.16, defenseBonus: 0.2 },
  ],
  dark: [
    { attackBonus: 0.25 },
    { attackBonus: 0.25, speedBonus: 3 },
    { attackBonus: 0.25, speedBonus: 3, doubleAtk: true, halfDefense: true },
  ],
  nature: [allStats(0.08), allStats(0.2), allStats(0.4)],
  dragon: [
    { hpBonus: 0.3 },
    { hpBonus: 0.3, attackBonus: 0.2 },
    { hpBonus: 0.8, attackBonus: 0.5 },
  ],
  void: [{ randomBonus: 0.2 }, { randomBonus: 0.5 }, { randomBonus: 0.5, randomDouble: true }],
  time: [
    { speedBonus: 3 },
    { speedBonus: 3, extraTurns: 2 },
    { speedBonus: 9, extraTurns: 5 },
  ],
  soul: [
    { xpBonus: 0.4 },
    { xpBonus: 0.4, attackBonus: 0.1 },
    { xpBonus: 0.4, attackBonus: 0.3, doubleXp: true },
  ],
  warrior: [
    { attackBonus: 0.15, defenseBonus: 0.1 },
    { attackBonus: 0.15, defenseBonus: 0.1, hpBonus: 0.2 },
    { attackBonus: 0.4, defenseBonus: 0.35, hpBonus: 0.2 },
  ],
  hunter: [
    { speedBonus: 4, goldBonus: 0.2 },
    { speedBonus: 4, goldBonus: 0.2, firstStrike: true },
    { speedBonus: 4, goldBonus: 0.4, firstStrike: true },
  ],
  sage: [
    { xpBonus: 0.3, defenseBonus: 0.1 },
    { xpBonus: 0.3, defenseBonus: 0.1, regen: 0.05 },
    { xpBonus: 0.3, defenseBonus: 0.4, regen: 0.05, doubleXp: true },
  ],
  thief: [
    { goldBonus: 0.3, speedBonus: 2 },
    { goldBonus: 0.3, speedBonus: 2, dodge: 0.15 },
    { goldBonus: 0.5, speedBonus: 2, dodge: 0.15 },
  ],
  king: [allStats(0.1), allStats(0.25), { ...allStats(0.5), dropCount: 2 }],
}

function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${label}: expected ${expected}, got ${actual}`)
}
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}
function noRng() { assert.fail('This operation must not consume RNG') }
function sequence(...values) {
  let calls = 0
  const rng = () => {
    assert.ok(calls < values.length, `Unexpected RNG draw ${calls + 1}`)
    return values[calls++]
  }
  Object.defineProperty(rng, 'calls', { get: () => calls })
  return rng
}
function equippedSet(setId, count = 5) {
  return Object.fromEntries(SLOTS.slice(0, count).map(slot => [slot, `eq_${setId}_${slot}_common:1:100`]))
}
function player(overrides = {}) {
  return {
    hp: 80, maxHp: 100, attackMultiplier: 1, defenseMultiplier: 1,
    flatAttack: 0, flatDefense: 0, bonusTurns: 0, baseMaxTurns: 6,
    spawnArmor: 0, goldBoost: 0, xpBoost: 0, baseSpeed: 3,
    equipment: {}, inventory: [], gold: 17, xp: 2, level: 1, xpToNext: 25,
    ...overrides,
  }
}
function grid(values = []) {
  return Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, col) => ({
    value: values[row * 4 + col] ?? 0, id: row * 4 + col, isNew: false, isMerged: false,
  })))
}
function battle(overrides = {}) {
  const enemy = { id: 'training', name: '训练目标', hp: 200, maxHp: 200, attack: 20, defense: 0, speed: 0, tier: 1, ...overrides.enemy }
  return {
    grid: grid(), turnsUsed: 6, maxTurns: 6, totalAttack: 20, totalDefense: 12,
    enemyCurrentHp: enemy.hp, phase: 'round_delay', result: null, round: 1,
    lastRoundResult: null, savedSteps: 0, fortifyUsed: false, mergeCount: 1,
    ...overrides, enemy,
  }
}

function checkSetThresholds() {
  const setIds = [...new Set(equipment.ALL_EQUIPMENT.filter(eq => eq.set).map(eq => eq.set))].sort()
  assert.deepEqual(setIds, Object.keys(SET_EXPECTATIONS).sort(), 'all 20 advertised sets are covered')
  assert.equal(setIds.length, 20)
  for (const [setId, thresholds] of Object.entries(SET_EXPECTATIONS)) {
    for (let count = 0; count <= 5; count++) {
      const equipped = freeze(equippedSet(setId, count))
      const expected = { ...EMPTY_EFFECTS, ...(count >= 5 ? thresholds[2] : count >= 3 ? thresholds[1] : count >= 2 ? thresholds[0] : {}) }
      const bonuses = equipment.computeEquipBonuses(equipped)
      const label = `${setId} ${count}pc`
      assert.deepEqual(Object.keys(bonuses.setEffects).sort(), Object.keys(expected).sort(), `${label} effect keys`)
      for (const [key, value] of Object.entries(expected)) {
        if (typeof value === 'number') close(bonuses.setEffects[key], value, `${label} ${key}`)
        else assert.equal(bonuses.setEffects[key], value, `${label} ${key}`)
      }
      const raw = freeze(player({
        hp: 50, attackMultiplier: 1.6, defenseMultiplier: 1.3,
        flatAttack: 7, flatDefense: 11, baseSpeed: 10, bonusTurns: 2,
        goldBoost: 0.2, xpBoost: 0.15, equipment: equipped,
      }))
      const effective = equipment.getEffectivePlayer(raw)
      const gear = { atk: 0, def: 0, hp: 0, spd: 0, gold: 0, xp: 0 }
      for (const slot of SLOTS.slice(0, count)) {
        for (const [key, value] of Object.entries(equipment.getSetData(setId).stats[slot])) gear[key] += value
      }
      close(effective.attackMultiplier, (1.6 + expected.attackBonus) * (expected.doubleAtk ? 2 : 1), `${label} attack`)
      close(effective.defenseMultiplier, (1.3 + expected.defenseBonus) * (expected.halfDefense ? 0.5 : 1), `${label} defense`)
      close(effective.baseSpeed, (10 + gear.spd + expected.speedBonus) * (1 + expected.speedPercent), `${label} speed`)
      assert.equal(effective.flatAttack, 7 + gear.atk, `${label} flat attack`)
      assert.equal(effective.flatDefense, 11 + gear.def, `${label} flat defense`)
      assert.equal(effective.maxHp, Math.floor((100 + gear.hp) * (1 + expected.hpBonus)), `${label} max HP`)
      assert.equal(effective.hp, 50, `${label} does not heal`)
      assert.equal(effective.bonusTurns, 2, `${label} caller adds extra turns only once`)
      assert.equal(effective.baseMaxTurns, 6)
      close(effective.goldBoost, 0.2 + gear.gold / 100 + expected.goldBonus, `${label} real gold multiplier`)
      close(effective.xpBoost, 0.15 + gear.xp / 100 + expected.xpBonus, `${label} real XP multiplier`)
      assert.equal(effective.gold, raw.gold, `${label} no fake gold balance`)
      assert.equal(effective.xp, raw.xp, `${label} no fake XP balance`)
      assert.deepEqual(bonuses.stats, { ...gear, atkPercent: 0, defPercent: 0 }, `${label} gear stats keep units`)
    }
  }
  const mixed = equipment.computeEquipBonuses({ ...equippedSet('tempest', 2), armor: 'eq_holy_armor_common:1:100', gloves: 'eq_holy_gloves_common:1:100', boots: 'eq_holy_boots_common:1:100' }).setEffects
  close(mixed.hpBonus, 0.2, 'mixed holy HP')
  close(mixed.regen, 0.08, 'mixed holy regen')
  assert.equal(mixed.speedBonus, 4, 'mixed tempest speed')
  assert.equal(mixed.extraTurns, 0, '2 tempest pieces do not give five-piece steps')
  const invalid = equipment.computeEquipBonuses({ pants: 'eq_tempest_pants_common', helmet: 'eq_tempest_pants_common', armor: 'missing', other: 'eq_tempest_helmet_common' })
  assert.equal(invalid.setEffects.speedBonus, 0, 'invalid slots cannot inflate set counts')
  assert.equal(invalid.stats.atk, 12)
  assert.match(equipment.getSetData('vampire').bonuses.five, /20%.*替代.*10%/)
  assert.match(equipment.getSetData('holy').bonuses.five, /16%.*替代.*8%/)
  assert.match(equipment.getSetData('thief').bonuses.five, /50%.*替代.*30%/)
  assert.match(equipment.getSetData('void').bonuses.two, /攻击倍率\/防御倍率\/速度/)
}

function checkEquipmentIdsAndStats() {
  const all = equipment.ALL_EQUIPMENT
  const noSet = all.filter(eq => !eq.set)
  assert.equal(all.length, 345)
  assert.equal(new Set(all.map(eq => eq.id)).size, all.length, 'every catalog ID is unique')
  assert.equal(noSet.length, 45)
  assert.equal(new Set(noSet.map(eq => eq.name)).size, 15)
  for (const eq of all) {
    assert.equal(equipment.equipmentById(`${eq.id}:2:100:copy7`), eq)
    assert.equal(equipment.isNoSetItem(eq.id), !eq.set)
  }
  assert.equal(equipment.equipmentById('eq_noset__boots_common:1:100').name, '幸运兔脚', 'legacy ambiguous ID resolves to former first match')
  assert.equal(equipment.equipmentById('eq_noset__helmet_epic').name, '佣兵头巾')
  assert.equal(equipment.equipmentById('missing'), undefined)
  assert.deepEqual(equipment.getEquipStats('missing'), {})
  assert.deepEqual(equipment.formatEquipStats('missing'), [])
  const canonical = equipment.equipmentById('eq_noset__boots_common').id
  assert.deepEqual(equipment.getEquipStats(`${canonical}:2:99`), equipment.getEquipStats('eq_noset__boots_common:2:99'))
  assert.equal(equipment.makeEquipId('eq_noset__boots_common', 2, 99), `${canonical}:2:99`)
  assert.equal(equipment.makeEquipId(canonical, 1), `${canonical}:1:100`, 'omitted RNG means deterministic 100%')
  assert.equal(equipment.makeEquipId(canonical, 1, 87, noRng), `${canonical}:1:87`, 'explicit fluct consumes no RNG')
  assert.equal(equipment.makeEquipId(canonical, 1, undefined, sequence(0)), `${canonical}:1:70`)
  assert.equal(equipment.makeEquipId(canonical, 1, undefined, sequence(0.999999)), `${canonical}:1:130`)
  assert.equal(equipment.makeEquipId(canonical, 1, -500), `${canonical}:1:70`)
  assert.equal(equipment.makeEquipId(canonical, 1, 500), `${canonical}:1:130`)
  assert.equal(equipment.makeEquipId(canonical, 1, NaN), `${canonical}:1:100`)
  assert.equal(equipment.makeEquipId(canonical, 0, 100), `${canonical}:1:100`)
  assert.deepEqual(equipment.getEquipStats('eq_tempest_pants_common:1:0'), { atk: 8 }, 'read clamps lower fluct to 70%')
  assert.deepEqual(equipment.getEquipStats('eq_tempest_pants_common:1:999'), { atk: 16 }, 'read clamps upper fluct to 130%')
  assert.deepEqual(equipment.getEquipStats('eq_tempest_pants_rare:3:100'), { atk: 22 }, 'existing rarity/level formula is unchanged')
  assert.deepEqual(equipment.getEquipStats('eq_treasure_pants_common:3:70'), { gold: 12 }, 'set reward stat retains existing level-only growth')
  assert.equal(equipment.equipCost({ rarity: 'common' }), 30)
  assert.equal(equipment.equipCost({ rarity: 'rare' }), 70)
  assert.equal(equipment.equipCost({ rarity: 'epic' }), 120)
  assert.equal(equipment.equipCost(undefined), 30)
  assert.deepEqual(equipment.formatEquipStats('eq_tempest_pants_common:1:100'), ['攻击+12'])
  assert.deepEqual(equipment.formatEquipStats('eq_fortress_pants_common:1:100'), ['防御+10'])
  assert.deepEqual(equipment.formatEquipStats('eq_holy_pants_common:1:100'), ['生命+10'])
  assert.deepEqual(equipment.formatEquipStats('eq_treasure_pants_common:1:100'), ['金币+10%'])
  assert.deepEqual(equipment.formatEquipStats('eq_soul_helmet_common:1:100'), ['经验+15%'])

  const ranges = { atk: [10, 22], def: [8, 18], hp: [8, 20], spd: [1, 4], gold: [5, 12], xp: [5, 12] }
  const labels = { atk: '攻击', def: '防御', hp: '生命', spd: '速度', gold: '金币', xp: '经验' }
  const buckets = Object.fromEntries(['common', 'rare', 'epic'].map(rarity => [rarity, { counts: [0, 0], keys: Object.fromEntries(Object.keys(ranges).map(key => [key, 0])), total: 0 }]))
  for (const eq of noSet) {
    const minCount = eq.rarity === 'common' ? 1 : eq.rarity === 'rare' ? 2 : 3
    for (let level = 1; level <= 8; level++) {
      for (const fluct of [70, 80, 90, 100, 110, 120, 130]) {
        const id = `${eq.id}:${level}:${fluct}`
        const stats = equipment.getEquipStats(id)
        const keys = Object.keys(stats)
        assert.ok(keys.length === minCount || keys.length === minCount + 1, `${id} has correct distinct rarity stat count`)
        assert.deepEqual(equipment.getEquipStats(id), stats, `${id} deterministic stats`)
        assert.deepEqual(equipment.getEquipStats(`${id}:copy42`), stats, `${id} copies retain all stats`)
        const bucket = buckets[eq.rarity]
        bucket.counts[keys.length - minCount]++
        bucket.total += keys.length
        const formatted = equipment.formatEquipStats(id)
        for (const [key, value] of Object.entries(stats)) {
          const [min, max] = ranges[key]
          const factor = (1 + (level - 1) * 0.12) * fluct / 100
          assert.ok(value >= Math.round(min * factor) && value <= Math.round(max * factor), `${id} ${key} stays within stated ranges`)
          bucket.keys[key]++
          const unit = ['atk', 'def', 'gold', 'xp'].includes(key) ? '%' : ''
          assert.ok(formatted.includes(`${labels[key]}+${value}${unit}`), `${id} ${key} display unit`)
        }
      }
    }
  }
  for (const [rarity, bucket] of Object.entries(buckets)) {
    const fraction = bucket.counts[0] / (bucket.counts[0] + bucket.counts[1])
    assert.ok(fraction > 0.4 && fraction < 0.6, `${rarity} both rarity counts occur evenly, not correlated linear samples`)
    for (const [key, count] of Object.entries(bucket.keys)) {
      const expected = bucket.total / 6
      assert.ok(Math.abs(count - expected) < expected * 0.3, `${rarity} ${key} receives broadly uniform unique picks`)
    }
  }
  const equipped = Object.fromEntries(SLOTS.map(slot => [slot, `${noSet.find(eq => eq.slot === slot && eq.rarity === 'epic').id}:3:100`]))
  const raw = freeze(player({ equipment: equipped, attackMultiplier: 2, defenseMultiplier: 1.5, goldBoost: 0.2, xpBoost: 0.3 }))
  const totals = { atk: 0, def: 0, hp: 0, spd: 0, gold: 0, xp: 0 }
  for (const id of Object.values(equipped)) for (const [key, value] of Object.entries(equipment.getEquipStats(id))) totals[key] += value
  const effective = equipment.getEffectivePlayer(raw)
  close(effective.attackMultiplier, 2 + totals.atk / 100, 'non-set attack is percentage points, not flat or compounding')
  close(effective.defenseMultiplier, 1.5 + totals.def / 100, 'non-set defense is percentage points')
  assert.equal(effective.flatAttack, 0)
  assert.equal(effective.flatDefense, 0)
  assert.equal(effective.maxHp, 100 + totals.hp, 'non-set HP is fixed')
  assert.equal(effective.baseSpeed, 3 + totals.spd, 'non-set speed is fixed')
  close(effective.goldBoost, 0.2 + totals.gold / 100, 'non-set real gold bonus')
  close(effective.xpBoost, 0.3 + totals.xp / 100, 'non-set real XP bonus')
  const stacked = freeze(player({ spawnArmor: 1000.8 }))
  assert.equal(equipment.getEffectivePlayer(stacked).spawnArmor, 1000.8)
  assert.equal(stacked.spawnArmor, 1000.8, 'raw stacked spawn armor is preserved without a gameplay cap')
  assert.equal(equipment.getEffectivePlayer(player({ spawnArmor: 0 })).spawnArmor, 0)
  assert.equal(equipment.getEffectivePlayer(player({ hp: 999 })).hp, 100)
  assert.equal(equipment.getEffectivePlayer(player({ hp: 0, equipment: equippedSet('holy') })).hp, 0, 'equipment never revives')
  const ids = [`${canonical}:1:100:copy2`, 'eq_tempest_pants_epic:1:100', 'eq_noset__helmet_rare:3:100']
  const original = [...ids]
  assert.equal(equipment.sortInventory(ids, 'quality')[0], ids[1])
  assert.equal(equipment.sortInventory(ids, 'level')[0], ids[2])
  assert.deepEqual(ids, original, 'sorting is pure')
}

function checkVoidAndPreview() {
  for (const count of [2, 3, 5]) {
    const effects = freeze(equipment.computeEquipBonuses(equippedSet('void', count)).setEffects)
    const rng = sequence(0.34, 0.99)
    const rolled = equipment.rollEquipEffects(effects, rng)
    assert.equal(rolled.randomStat, 'defense')
    assert.equal(rolled.randomBonus, count === 2 ? 0.2 : 0.5)
    assert.equal(rolled.doubleStat, count === 5 ? 'speed' : undefined)
    assert.equal(rng.calls, count === 5 ? 2 : 1)
    assert.equal(effects.randomStat, undefined, 'void roll does not mutate input')
    assert.equal(effects.doubleStat, undefined)
  }
  const cleared = equipment.rollEquipEffects({ randomStat: 'attack', doubleStat: 'speed' }, noRng)
  assert.deepEqual(cleared, {}, 'inactive effects discard stale selections without RNG')
  const rerolled = equipment.rollEquipEffects(freeze({ randomBonus: 0.5, randomDouble: true, randomStat: 'attack', doubleStat: 'attack' }), sequence(0.9, 0.4))
  assert.equal(rerolled.randomStat, 'speed', 'explicit round roll replaces earlier selection')
  assert.equal(rerolled.doubleStat, 'defense')
  for (const attribute of ['attack', 'defense', 'speed']) {
    const raw = freeze(player({ attackMultiplier: 2, defenseMultiplier: 1.5, baseSpeed: 10 }))
    const effective = equipment.getEffectivePlayer(raw, { randomBonus: 0.5, randomDouble: true, randomStat: attribute, doubleStat: attribute })
    close(effective.attackMultiplier, attribute === 'attack' ? 5 : 2, `void ${attribute} attack`)
    close(effective.defenseMultiplier, attribute === 'defense' ? 4 : 1.5, `void ${attribute} defense`)
    close(effective.baseSpeed, attribute === 'speed' ? 30 : 10, `void ${attribute} speed`)
    assert.equal(effective.maxHp, raw.maxHp, 'void chooses combat attributes, never HP or rewards')
    assert.equal(effective.goldBoost, 0)
    assert.equal(effective.xpBoost, 0)
  }
  const effects = equipment.computeEquipBonuses(equippedSet('void')).setEffects
  assert.deepEqual(equipment.rollEquipEffects(effects, random.createRng(77)), equipment.rollEquipEffects(effects, random.createRng(77)))
  const rolled = equipment.rollEquipEffects(effects, sequence(0, 0.99))
  const raw = freeze(player({ equipment: equippedSet('void') }))
  const state = freeze(battle({ equipEffects: rolled }))
  const before = JSON.stringify({ raw, state })
  assert.deepEqual(combat.getBattlePreview(state, raw), combat.getBattlePreview(state, raw), 'preview is stable with rolled void effects')
  const result = combat.resolveRound(state, raw, noRng)
  const preview = combat.getBattlePreview(state, raw)
  assert.equal(result.enemyDamage, preview.enemyDamage)
  assert.equal(result.playerDamage, preview.playerDamage)
  assert.equal(result.playerSpeed, preview.playerSpeed)
  assert.equal(JSON.stringify({ raw, state }), before, 'preview and resolution are pure')
  assert.deepEqual(combat.resolveRound(battle({ equipEffects: effects }), raw, sequence(0, 0.99)), result, 'unrolled independent caller uses its supplied RNG')
  assert.equal(combat.resolveRound.length, 3)
  const unresolved = combat.getBattlePreview(battle({ equipEffects: effects }), raw)
  const base = equipment.getEffectivePlayer(raw)
  assert.equal(unresolved.player.attackMultiplier, base.attackMultiplier, 'preview never secretly rolls unresolved void effects')

  for (const setId of Object.keys(SET_EXPECTATIONS)) {
    for (const count of [2, 3, 5]) {
      const p = freeze(player({ hp: 500, maxHp: 1000, equipment: equippedSet(setId, count) }))
      const eff = equipment.rollEquipEffects(equipment.computeEquipBonuses(p.equipment).setEffects, random.createRng(11))
      const b = freeze(battle({ enemy: { hp: 10000, attack: 200, defense: 31, speed: 40 }, totalAttack: 80, equipEffects: eff, grid: grid([2, 4, 8, 16]), round: 3 }))
      const pvw = combat.getBattlePreview(b, p)
      const resolved = combat.resolveRound(b, p, () => 0.99)
      assert.equal(resolved.enemyDamage, pvw.enemyDamage, `${setId} ${count}pc preview/resolve outgoing damage`)
      assert.equal(resolved.playerDamage, pvw.playerDamage, `${setId} ${count}pc preview/resolve incoming damage`)
      assert.equal(resolved.playerFirst, pvw.playerFirst)
      assert.equal(resolved.playerSpeed, pvw.playerSpeed)
      assert.equal(resolved.enemySpeed, pvw.enemySpeed)
    }
  }
}

function checkCombatSequencing() {
  const baseline = combat.getBattlePreview(battle(), player())
  assert.equal(baseline.enemyDamage, 20)
  assert.equal(baseline.playerDamage, 20)
  assert.equal(baseline.defenseValue, 0)
  assert.equal(baseline.playerSpeed, 19)
  assert.equal(baseline.enemySpeed, 0)
  assert.equal(baseline.playerFirst, true)
  const ordinary = combat.resolveRound(freeze(battle()), freeze(player()), noRng)
  assert.equal(ordinary.playerHpAfter, 60)
  assert.equal(ordinary.enemyHpAfter, 180)
  assert.equal(ordinary.healing, 0)
  assert.equal(ordinary.avoidReason, null)
  assert.equal(ordinary.playerActed, true)
  assert.equal(ordinary.enemyActed, true)
  const formula = combat.getBattlePreview(battle({
    enemy: { attack: 30, defense: 11, speed: 27 }, round: 3, totalAttack: 37,
    grid: grid([2, 4, 8, 16]), equipEffects: { enemyAtkDown: 0.3, enemySpdDown: 4, pierce: 0.4 },
  }), player({ attackMultiplier: 1.3, defenseMultiplier: 1.2, flatAttack: 7, flatDefense: 4, spawnArmor: 0.2 }))
  assert.equal(formula.enemyAttack, 23, 'linear enemy attack scaling (buffered after round 2) then equipment percent weakening only')
  assert.equal(formula.enemyDefense, 8, 'linear defense growth then pierce')
  assert.equal(formula.enemySpeed, 24)
  assert.equal(formula.defenseValue, 14, 'board armor divisor 3 plus accumulated spawn armor')
  assert.equal(formula.enemyDamage, 47, 'existing floor(totalAttack * multiplier - defense) + flatAttack')
  assert.equal(formula.playerDamage, 11, 'ceil(23 * 15 / (15 + 14 + 4)) rational armor damage')
  assert.equal(formula.playerFirst, false)
  const slowed = combat.getBattlePreview(battle({ enemy: { speed: 2 }, equipEffects: { enemySpdDown: 4 } }), player())
  assert.equal(slowed.enemySpeed, 1)
  const firstStrike = combat.resolveRound(battle({ enemy: { speed: 999 }, equipEffects: { firstStrike: true } }), player(), noRng)
  assert.equal(firstStrike.playerFirst, true)

  const fatal = combat.resolveRound(battle({ enemy: { speed: 100 }, totalAttack: 999, equipEffects: { lifesteal: 1, regen: 1 } }), player({ hp: 5 }), noRng)
  assert.equal(fatal.playerFirst, false)
  assert.equal(fatal.playerHpAfter, 0)
  assert.equal(fatal.enemyHpAfter, 200, 'killed before acting means enemy takes no damage')
  assert.equal(fatal.enemyDamage, 0)
  assert.equal(fatal.playerActed, false)
  assert.equal(fatal.enemyActed, true)
  assert.equal(fatal.healing, 0, 'death cannot be rescued by lifesteal, regen or theoretical kill')
  assert.equal(fatal.overflowDamage, 0)
  const firstHeal = combat.resolveRound(battle({ enemy: { attack: 4 }, equipEffects: { lifesteal: 0.2 } }), player({ hp: 1 }), noRng)
  assert.equal(firstHeal.playerHpAfter, 1, 'lifesteal occurs before a slower enemy attack and can keep player alive')
  assert.equal(firstHeal.healing, 4)
  const secondHeal = combat.resolveRound(battle({ enemy: { speed: 100 }, equipEffects: { lifesteal: 0.2 } }), player(), noRng)
  assert.equal(secondHeal.playerHpAfter, 64, 'lifesteal works on nonlethal enemy-first rounds')
  assert.equal(secondHeal.healing, 4)
  const overkill = combat.resolveRound(battle({ enemyCurrentHp: 3, totalAttack: 100, equipEffects: { lifesteal: 1, dodge: 0.5, skipChance: 0.5 } }), player({ hp: 60 }), noRng)
  assert.equal(overkill.enemyDamage, 100)
  assert.equal(overkill.overflowDamage, 97)
  assert.equal(overkill.healing, 3, 'overkill cannot generate healing')
  assert.equal(overkill.playerHpAfter, 63)
  assert.equal(overkill.enemyActed, false)
  assert.equal(overkill.avoidReason, 'kill', 'kill consumes no irrelevant chance RNG')
  const cap = combat.resolveRound(battle({ equipEffects: { lifesteal: 1 } }), player({ hp: 99 }), noRng)
  assert.equal(cap.healing, 1, 'lifesteal is capped at current missing HP before incoming damage')
  assert.equal(cap.playerHpAfter, 80)
  const noHit = combat.resolveRound(battle({ totalAttack: 0, equipEffects: { lifesteal: 1 } }), player(), noRng)
  assert.equal(noHit.healing, 0)
  assert.equal(noHit.playerActed, false, 'zero accumulated merge charge cannot attack even with flat equipment damage')
  const regen = combat.resolveRound(battle({ equipEffects: { regen: 0.1 } }), player(), noRng)
  assert.equal(regen.playerHpAfter, 70)
  assert.equal(regen.healing, 10, 'regen happens once at round end')
  const both = combat.resolveRound(battle({ equipEffects: { lifesteal: 0.2, regen: 0.1 } }), player(), noRng)
  assert.equal(both.playerHpAfter, 74)
  assert.equal(both.healing, 14, 'lifesteal then attack then exactly one regen')
  const winRegen = combat.resolveRound(battle({ enemyCurrentHp: 1, equipEffects: { regen: 0.2 } }), player({ hp: 95 }), noRng)
  assert.equal(winRegen.playerHpAfter, 100)
  assert.equal(winRegen.healing, 5)
  const dead = combat.resolveRound(battle({ equipEffects: { regen: 1, lifesteal: 1, randomBonus: 0.5, randomDouble: true } }), player({ hp: 0 }), noRng)
  assert.equal(dead.playerHpAfter, 0)
  assert.equal(dead.playerActed, false)
  assert.equal(dead.enemyActed, false)
  assert.equal(dead.healing, 0)
  const ended = combat.resolveRound(battle({ enemyCurrentHp: 0, equipEffects: { regen: 1 } }), player(), noRng)
  assert.equal(ended.healing, 0, 'an already-ended battle does not grant another round heal')
}

function checkFortifyAndAvoidance() {
  const effects = freeze({ fortify: true, reflect: 5 })
  const state = freeze(battle({ equipEffects: effects }))
  const preview = combat.getBattlePreview(state, player())
  assert.equal(preview.defenseValue, 0, 'fortify never changes defense multiplier')
  assert.equal(preview.playerDamage, 10)
  const first = combat.resolveRound(state, player(), noRng)
  assert.equal(first.playerDamage, 10)
  assert.equal(first.reflectedDamage, 5)
  assert.equal(first.enemyHpAfter, 175)
  assert.equal(first.enemyDamage, 20, 'reflected damage is separate from player attack')
  assert.equal(first.fortifyUsed, true)
  assert.equal(first.fortifyTriggered, true)
  assert.equal(state.fortifyUsed, false, 'resolution does not mutate battle')
  const next = combat.startNewRound({ ...state, fortifyUsed: first.fortifyUsed, enemyCurrentHp: first.enemyHpAfter }, noRng)
  assert.equal(next.fortifyUsed, true, 'new round preserves first-hit usage')
  const second = combat.resolveRound(next, player({ hp: first.playerHpAfter }), noRng)
  assert.equal(second.playerDamage, 20, 'second round incoming attack is not halved (growth starts round 3)')
  assert.equal(second.reflectedDamage, 0, 'reflect is only on that first actual hit')
  assert.equal(second.fortifyUsed, true)
  assert.equal(second.fortifyTriggered, false)
  const odd = combat.resolveRound(battle({ enemy: { attack: 5 }, equipEffects: effects }), player(), noRng)
  assert.equal(odd.playerDamage, 3, 'half of odd integer damage rounds up')
  const smallest = combat.resolveRound(battle({ enemy: { attack: 1 }, equipEffects: effects }), player(), noRng)
  assert.equal(smallest.playerDamage, 1)
  assert.equal(smallest.fortifyTriggered, true)

  const skipRng = sequence(0)
  const skip = combat.resolveRound(battle({ equipEffects: { ...effects, skipChance: 0.2, dodge: 0.1 } }), player(), skipRng)
  assert.equal(skip.avoidReason, 'skip')
  assert.equal(skip.enemyActed, false)
  assert.equal(skipRng.calls, 1, 'skip does not also roll dodge')
  const dodgeRng = sequence(0.9, 0.05)
  const dodge = combat.resolveRound(battle({ equipEffects: { ...effects, skipChance: 0.2, dodge: 0.1 } }), player(), dodgeRng)
  assert.equal(dodge.avoidReason, 'dodge')
  assert.equal(dodge.enemyActed, true)
  assert.equal(dodgeRng.calls, 2)
  const armored = combat.resolveRound(battle({ equipEffects: effects }), player({ flatDefense: 20 }), noRng)
  assert.equal(armored.avoidReason, null, 'ordinary positive attack is never completely blocked by armor')
  assert.equal(armored.enemyActed, true)
  assert.equal(armored.playerDamage, 5, 'ceil(ceil(20 * 15 / (15 + 20)) / 2): armor then first-hit halving')
  assert.equal(armored.fortifyTriggered, true)
  assert.equal(armored.reflectedDamage, 5)
  const kill = combat.resolveRound(battle({ enemyCurrentHp: 1, equipEffects: { ...effects, dodge: 0.1, skipChance: 0.2 } }), player(), noRng)
  assert.equal(kill.avoidReason, 'kill')
  assert.equal(kill.enemyActed, false)
  for (const avoided of [skip, dodge, kill]) {
    assert.equal(avoided.playerDamage, 0)
    assert.equal(avoided.fortifyUsed, false, 'avoided damage does not consume first-hit fortify')
    assert.equal(avoided.fortifyTriggered, false)
    assert.equal(avoided.reflectedDamage, 0)
  }
  const afterAvoid = combat.resolveRound(battle({ equipEffects: effects, fortifyUsed: dodge.fortifyUsed }), player(), noRng)
  assert.equal(afterAvoid.playerDamage, 10)
  assert.equal(afterAvoid.reflectedDamage, 5)
  const enemySkippedFirst = combat.resolveRound(battle({ enemy: { speed: 100 }, equipEffects: { skipChance: 1 } }), player({ hp: 1 }), sequence(0))
  assert.equal(enemySkippedFirst.playerActed, true)
  assert.equal(enemySkippedFirst.enemyActed, false)
  assert.equal(enemySkippedFirst.playerHpAfter, 1)
  const reflectKill = combat.resolveRound(battle({ enemy: { speed: 100 }, enemyCurrentHp: 4, equipEffects: { ...effects, lifesteal: 1 } }), player({ hp: 30 }), noRng)
  assert.equal(reflectKill.enemyHpAfter, 0)
  assert.equal(reflectKill.reflectedDamage, 4, 'reflection is capped at remaining enemy HP')
  assert.equal(reflectKill.playerActed, false, 'reflection kill prevents a later pointless player attack')
  assert.equal(reflectKill.enemyDamage, 0)
  assert.equal(reflectKill.healing, 0, 'reflection is not lifesteal')
  const mutual = combat.resolveRound(battle({ enemy: { speed: 100 }, enemyCurrentHp: 3, equipEffects: { ...effects, lifesteal: 1, regen: 1 } }), player({ hp: 5 }), noRng)
  assert.equal(mutual.playerHpAfter, 0, 'even a reflection kill does not resurrect the player')
  assert.equal(mutual.enemyHpAfter, 0)
  assert.equal(mutual.reflectedDamage, 3)
  assert.equal(mutual.healing, 0)
  assert.equal(mutual.playerActed, false)
}

function checkBattleApis() {
  const state = freeze(battle({ phase: 'playing' }))
  for (const invalid of ['diagonal', '', 'LEFT', '__proto__', undefined, null]) {
    assert.equal(combat.processTurn(state, invalid, noRng), state, `invalid direction ${invalid} is ignored without RNG`)
  }
  const notPlaying = freeze(battle())
  assert.equal(combat.processTurn(notPlaying, 'left', noRng), notPlaying)
  const started = combat.initBattle(battle().enemy, 8, random.createRng(91), 24)
  assert.equal(started.maxTurns, 8)
  assert.equal(started.round, 1)
  assert.equal(started.fortifyUsed, false)
  assert.equal(started.grid.flat().filter(cell => cell.value).length, 4)
  assert.ok(started.grid.flat().some(cell => cell.value === 8))
  assert.ok(started.grid.flat().some(cell => cell.value === 16))
  const moving = freeze(battle({ grid: grid([2, 2]), phase: 'playing', turnsUsed: 0, maxTurns: 1, totalAttack: 0, totalDefense: 0 }))
  const rng = sequence(0.99, 0)
  const moved = combat.processTurn(moving, 'left', rng)
  assert.equal(moved.phase, 'round_delay')
  assert.equal(moved.turnsUsed, 1)
  assert.equal(moved.totalAttack, 4)
  assert.equal(moved.totalDefense, 2)
  assert.equal(rng.calls, 2)
  assert.equal(moving.turnsUsed, 0)
  const next = combat.startNewRound({ ...moved, savedSteps: 7, fortifyUsed: true }, random.createRng(92), 8)
  assert.equal(next.phase, 'playing')
  assert.equal(next.round, 2)
  assert.equal(next.turnsUsed, 0)
  assert.equal(next.totalAttack, 0)
  assert.equal(next.totalDefense, 0)
  // 剩余步数按本轮 maxTurns − turnsUsed 重算（过载核心的依据），不再沿用上回合残留值。
  assert.equal(next.savedSteps, 0)
  assert.equal(next.fortifyUsed, true)
}

async function checkRewardIntegration() {
  const { createRequire } = await import('node:module')
  const { createPinia, setActivePinia } = createRequire(import.meta.url)('pinia')
  const { useGameStore } = loadProject('./store/gameStore')
  function killWithSet(setId) {
    setActivePinia(createPinia())
    const store = useGameStore()
    store.START_RUN(42)
    store.player.equipment = setId ? equippedSet(setId) : {}
    store.route = [{ id: 'equipment-regression', type: 'battle', layer: 1, position: 0, nextIds: [], completed: false, accessible: true, enemy: { id: 'rat', name: '测试敌人', hp: 1, maxHp: 1, attack: 0, defense: 0, speed: 0, tier: 4 } }]
    store.SELECT_NODE('equipment-regression')
    store.battle.totalAttack = 100
    store.END_TURN_EARLY()
    assert.equal(store.battle.result.playerWon, true)
    return store
  }
  const normal = killWithSet('')
  const king = killWithSet('king')
  const treasure = killWithSet('treasure')
  assert.equal(normal.battle.result.droppedEquipmentIds.length, 1, 'tier-four baseline guarantees one equipment drop')
  assert.equal(king.battle.result.droppedEquipmentIds.length, 2, 'king five-piece produces two actual equipment drops')
  for (const id of king.battle.result.droppedEquipmentIds) assert.ok(king.player.inventory.includes(id), 'each king drop reaches inventory')
  assert.equal(king.battle.result.goldEarned, normal.battle.result.goldEarned, 'king all-attribute bonuses do not double gold')
  assert.equal(king.battle.result.xpEarned, normal.battle.result.xpEarned, 'king all-attribute bonuses do not double XP')
  assert.equal(treasure.battle.result.droppedEquipmentIds.length, 1, 'treasure improves rarity, not count')
  const rarities = ['common', 'rare', 'epic']
  const originalRarity = equipment.equipmentById(normal.battle.result.droppedEquipmentIds[0]).rarity
  const upgradedRarity = equipment.equipmentById(treasure.battle.result.droppedEquipmentIds[0]).rarity
  assert.equal(upgradedRarity, rarities[Math.min(2, rarities.indexOf(originalRarity) + 1)], 'treasure increases the same seeded drop rarity by one tier')
  assert.equal(treasure.battle.result.goldEarned, 111, 'treasure: floor(60 * 1.65) + 6 saved steps * 2, not double gold')
  assert.equal(treasure.battle.result.xpEarned, 57, 'treasure: floor((32 + floor(100/8)) * 1.3)')
  const soul = killWithSet('soul')
  assert.equal(soul.battle.result.xpEarned, 158, 'soul: floor(44 * (1 + .4 gear + .4 set)) * 2')
  const sage = killWithSet('sage')
  assert.equal(sage.battle.result.xpEarned, 126, 'sage: floor(44 * (1 + .15 gear + .3 set)) * 2')

  setActivePinia(createPinia())
  const store = useGameStore()
  store.START_RUN(43)
  store.battle = battle({ phase: 'playing', turnsUsed: 0, enemy: { speed: 100 }, enemyCurrentHp: 3, equipEffects: { fortify: true, reflect: 5, lifesteal: 1, regen: 1 } })
  store.screen = 'battle'
  store.player.hp = 5
  store.END_TURN_EARLY()
  assert.equal(store.player.hp, 0)
  assert.equal(store.battle.result.playerWon, false, 'store gives death priority even if reflection also kills')
  assert.equal(store.battle.result.goldEarned, 0)
  assert.equal(store.battle.fortifyUsed, true, 'store persists fortify usage from resolution')
}

export async function run() {
  const ambientRandom = Math.random
  Math.random = () => { throw new Error('Equipment/combat must use explicit deterministic RNG') }
  try {
    checkSetThresholds()
    checkEquipmentIdsAndStats()
    checkVoidAndPreview()
    checkCombatSequencing()
    checkFortifyAndAvoidance()
    checkBattleApis()
  } finally {
    Math.random = ambientRandom
  }
  await checkRewardIntegration()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run()
  console.log('PASS equipment-combat.mjs (20 sets, deterministic equipment, combat and rewards)')
}
