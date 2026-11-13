import assert from 'node:assert/strict'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const cards = loadProject('./core/upgrade')
  const effects = loadProject('./core/cardEffects')
  const consumables = loadProject('./core/consumables')
  const enemies = loadProject('./core/enemy')
  const { createRng } = loadProject('./core/random')
  const byId = id => {
    const def = cards.cardById(id)
    assert.ok(def, `required card ${id} exists`)
    return def
  }
  const clone = def => JSON.parse(JSON.stringify(def))

  assert.deepEqual(cards.CARD_CLASSES, ['white', 'blue', 'gold', 'red', 'purple', 'black'])
  assert.deepEqual(cards.NORMAL_CARD_CLASSES, ['white', 'blue', 'gold'])
  assert.equal(cards.UPGRADE_POOL.length, 47)
  assert.equal(new Set(cards.UPGRADE_POOL.map(def => def.id)).size, 47)
  assert.equal(cards.UPGRADE_POOL.filter(def => def.kind === 'instant').length, 2)
  for (const def of cards.UPGRADE_POOL) {
    assert.equal(cards.validateCard(def), true, `${def.id} validates`)
    assert.equal(cards.cardById(def.id), def)
    assert.ok(['attack', 'defense', 'health', 'vitality', 'time', 'starting-tile', 'ward', 'weakness', 'wealth'].includes(def.icon), 'cards use semantic image asset keys')
    assert.ok(def.effects.every(effect => effect.description))
    assert.ok(!('rarity' in def) && !('effect' in def) && !('maxStacks' in def))
    assert.ok(!/上限\s*\d+\s*(张|份)|最多持有/.test(def.description), 'no inventory caps in descriptions')
    if (def.cardClass === 'white') assert.ok(def.effects.every(effect => effect.scope === 'stat'))
    if (def.cardClass === 'blue') assert.ok(def.effects.every(effect => effect.scope === 'parameter'))
    if (def.cardClass === 'gold') assert.ok(def.effects.every(effect => effect.scope === 'mechanic' && effect.polarity === 'positive'))
    if (def.cardClass === 'red') {
      assert.equal(def.effects.length, 2)
      assert.equal(def.effects.filter(effect => effect.polarity === 'positive').length, 1)
      assert.equal(def.effects.filter(effect => effect.polarity === 'negative').length, 1)
      assert.ok(def.effects.every(effect => effect.scope === 'mechanic'))
    }
    if (['purple', 'black'].includes(def.cardClass)) assert.ok(def.effects.every(effect => effect.scope === 'mechanic' && effect.polarity === 'negative'))
  }
  assert.equal(cards.cardById('missing'), undefined)
  for (const malformed of [null, {}, { ...byId('atk_up_1'), rarity: 'common' }, { ...byId('atk_up_1'), effect: {} }, { ...byId('atk_up_1'), maxStacks: 1000 }]) {
    assert.equal(cards.validateCard(malformed), false)
  }
  const invalids = [
    { ...clone(byId('atk_up_1')), cardClass: 'blue' },
    { ...clone(byId('bonus_turn_0_5')), cardClass: 'gold' },
    { ...clone(byId('gold_combo')), cardClass: 'purple' },
    { ...clone(byId('curse_burn')), cardClass: 'gold' },
    { ...clone(byId('red_berserk')), effects: [clone(byId('red_berserk').effects[0])] },
    { ...clone(byId('red_berserk')), effects: [...clone(byId('red_berserk').effects), clone(byId('curse_burn').effects[0])] },
    { ...clone(byId('red_berserk')), effects: [{ ...clone(byId('red_berserk').effects[0]), value: 0.08 }, clone(byId('red_berserk').effects[1])] },
    { ...clone(byId('heal_1')), kind: 'persistent' },
    { ...clone(byId('atk_up_1')), kind: 'instant' },
  ]
  for (const def of invalids) assert.equal(cards.validateCard(def), false)
  for (const change of [{ value: Infinity }, { value: -0.2 }, { value: 0 }, { type: 'invented' }, { type: '__proto__' }, { polarity: 'negative' }, { scope: 'mechanic' }, { description: '' }]) {
    const bad = clone(byId('atk_up_1'))
    Object.assign(bad.effects[0], change)
    assert.equal(cards.validateCard(bad), false, `reject invalid effect ${JSON.stringify(change)}`)
  }

  for (const def of cards.UPGRADE_POOL) {
    assert.equal(cards.canRemoveCard(def, 'shop'), def.kind === 'persistent' && ['white', 'blue', 'gold', 'red'].includes(def.cardClass))
    assert.equal(cards.canRemoveCard(def, 'cleanse'), def.cardClass === 'purple')
    assert.equal(cards.cardEffectText(def.effects[0]), def.effects[0].description)
    assert.ok(cards.cardClassText(def.cardClass).includes('色'))
    assert.ok(cards.cardClassDescription(def.cardClass).length > 0)
  }
  assert.equal(cards.upgradeCost(byId('atk_up_1')), 20)
  assert.equal(cards.upgradeCost(byId('atk_up_2')), 50)
  assert.equal(cards.upgradeCost(byId('gold_combo')), 90)
  assert.equal(cards.upgradeCost(byId('red_berserk')), 0)
  assert.equal(cards.upgradeCost(byId('curse_burn')), null)
  assert.equal(cards.upgradeCost(byId('doom_soul')), null)
  assert.equal(cards.upgradeCost(undefined), null)
  assert.equal(cards.upgradeCost({ rarity: 'epic' }), null)

  const expected = {
    atk_up_1: ['white', 'attackBonus', 0.08], def_up_1: ['white', 'defenseBonus', 0.08],
    max_hp_1: ['white', 'maxHpBonus', 8], gold_1: ['white', 'goldBonus', 0.03],
    balanced_1: ['white', 'attackBonus', 0.05], vigor_1: ['white', 'maxHpBonus', 6],
    xp_1: ['white', 'xpBonus', 0.1], flat_def_1: ['white', 'flatDamageReduction', 1],
    bonus_turn_0_5: ['blue', 'bonusTurns', 1], atk_up_2: ['blue', 'mergeCoefficient', 0.1],
    spawn_red_1: ['blue', 'spawnArmor', 0.2], start_tile_1: ['blue', 'startingPoints', 4],
    charge_start_1: ['blue', 'chargeStart', 3], spawn_luck_1: ['blue', 'spawnLuck', 0.05],
    halve_shield_1: ['blue', 'halveShield', 0.1], guarded_stance: ['blue', 'guardedStance', 1],
    gold_combo: ['gold', 'comboBonus', 4], gold_merge_armor: ['gold', 'mergeArmor', 0.25],
    gold_carry: ['gold', 'armorCarry', 0.25], gold_lifesteal: ['gold', 'lifestealRating', 0.08],
    gold_combo_grace: ['gold', 'comboGrace', 0.5], gold_execute: ['gold', 'executeRating', 0.05],
    gold_crit: ['gold', 'critRating', 0.08], gold_saved_steps: ['gold', 'savedStepsCharge', 2],
    red_berserk: ['red', 'burstCoefficient', 1], red_blood: ['red', 'lifestealRating', 0.5],
    red_double: ['red', 'extraStrikeRating', 1], red_hunt: ['red', 'executeRating', 1],
    red_greed: ['red', 'greedRating', 1], thorn_aegis: ['red', 'thornRating', 1],
    curse_burn: ['purple', 'burn', 2],
    curse_decay: ['purple', 'healingPenalty', 0.2], curse_charge: ['purple', 'chargeLoss', 0.15],
    curse_heavy: ['purple', 'heavyLegs', 1], curse_brittle: ['purple', 'armorErosion', 0.15],
    doom_soul: ['black', 'soulRecoil', 2], doom_rebirth: ['black', 'enemyRegen', 4],
    doom_rage: ['black', 'enemyRage', 1],
    war_soul_totem: ['gold', 'killAttackBonus', 0.02], soul_orb: ['gold', 'killHpBonus', 3],
    smelting_mastery: ['gold', 'smeltMastery', 0.01], spend_blade: ['gold', 'spendBlade', 0.01],
    veteran_blade: ['gold', 'veteranBlade', 0.01], blood_fury: ['red', 'lowHpFury', 6],
    shield_grind: ['gold', 'shieldGrind', 1],
    heal_1: ['white', 'heal', 12], heal_2: ['white', 'heal', 30],
  }
  for (const [id, [cardClass, type, value]] of Object.entries(expected)) {
    const def = byId(id)
    assert.equal(def.cardClass, cardClass)
    assert.equal(def.effects[0].type, type)
    assert.equal(def.effects[0].value, value)
  }
  assert.deepEqual(byId('red_berserk').effects.map(({ type, value }) => [type, value]), [['burstCoefficient', 1], ['vulnerability', 0.3]])
  assert.deepEqual(byId('red_blood').effects.map(({ type, value }) => [type, value]), [['lifestealRating', 0.5], ['bleed', 3]])
  assert.deepEqual(byId('red_double').effects.map(({ type, value }) => [type, value]), [['extraStrikeRating', 1], ['backlash', 4]])
  assert.deepEqual(byId('red_hunt').effects.map(({ type, value }) => [type, value]), [['executeRating', 1], ['vulnerability', 0.25]])
  assert.deepEqual(byId('red_greed').effects.map(({ type, value }) => [type, value]), [['greedRating', 1], ['burn', 4]])
  assert.deepEqual(byId('thorn_aegis').effects.map(({ type, value }) => [type, value]), [['thornRating', 1], ['chargeLoss', 0.3]])

  const held = Object.entries(expected).map(([id]) => ({ def: byId(id), count: 1000 }))
  const heldBefore = JSON.stringify(held)
  const modifiers = effects.collectCardModifiers(held)
  assert.deepEqual(effects.emptyCardModifiers(), Object.fromEntries(Object.keys(modifiers).map(key => [key, 0])))
  assert.equal(Object.keys(modifiers).length, 44)
  assert.equal(modifiers.attackBonus, 130)
  assert.equal(modifiers.defenseBonus, 160)
  assert.equal(modifiers.maxHpBonus, 14000)
  assert.equal(modifiers.xpBonus, 100)
  assert.equal(modifiers.bonusTurns, 1000)
  assert.equal(modifiers.spawnArmor, 200)
  assert.equal(modifiers.startingPoints, 4000)
  assert.equal(modifiers.chargeStart, 3000)
  assert.equal(modifiers.spawnLuck, 50)
  assert.equal(modifiers.halveShield, 100)
  assert.equal(modifiers.comboGrace, 500)
  assert.equal(modifiers.executeRating, 1050)
  assert.equal(modifiers.critRating, 80)
  assert.equal(modifiers.savedStepsCharge, 2000)
  assert.equal(modifiers.greedRating, 1000)
  assert.equal(modifiers.killAttackBonus, 20)
  assert.equal(modifiers.killHpBonus, 3000)
  assert.equal(modifiers.smeltMastery, 10)
  assert.equal(modifiers.spendBlade, 10)
  assert.equal(modifiers.veteranBlade, 10)
  assert.equal(modifiers.lowHpFury, 6000)
  assert.equal(modifiers.flatDamageReduction, 1000)
  assert.equal(modifiers.guardedStance, 1000)
  assert.equal(modifiers.thornRating, 1000)
  assert.equal(modifiers.shieldGrind, 1000)
  assert.equal(modifiers.lifestealRating, 580)
  assert.equal(modifiers.bleed, 3000)
  assert.equal(modifiers.burn, 6000)
  assert.equal(modifiers.heavyLegs, 1000)
  assert.equal(modifiers.armorErosion, 150)
  assert.equal(modifiers.enemyRage, 1000)
  assert.equal(modifiers.soulRecoil, 2000)
  assert.equal(modifiers.enemyRegen, 4000)
  assert.ok(!('heal' in modifiers))
  assert.equal(JSON.stringify(held), heldBefore)
  assert.deepEqual(effects.modifiersFromEffects(byId('heal_1').effects), {})
  assert.deepEqual(effects.modifiersFromEffects(byId('red_berserk').effects), { burstCoefficient: 1, vulnerability: 0.3 })
  let valueReads = 0
  const monitored = clone(byId('atk_up_1'))
  Object.defineProperty(monitored.effects[0], 'value', { get() { valueReads++; return 0.08 } })
  assert.equal(effects.collectCardModifiers([{ def: monitored, count: 1000 }]).attackBonus, 80)
  assert.ok(valueReads < 10, '1000 copies are multiplied, not expanded or looped')
  const raw = {
    hp: 23, maxHp: 40, attackMultiplier: 1, defenseMultiplier: 1, flatAttack: 0, flatDefense: 0,
    bonusTurns: 0, baseMaxTurns: 8, spawnArmor: 0, goldBoost: 1, xpBoost: 1, baseSpeed: 4,
    equipment: {}, inventory: [], gold: 0, xp: 0, level: 1, xpToNext: 10,
  }
  const beforeRaw = JSON.stringify(raw)
  const derived = effects.deriveCardPlayer(raw, held)
  assert.equal(derived.hp, 23)
  assert.equal(derived.maxHp, 14040)
  assert.equal(derived.attackMultiplier, 131)
  assert.equal(derived.defenseMultiplier, 161)
  assert.equal(derived.goldBoost, 31)
  assert.equal(derived.xpBoost, 101)
  assert.equal(derived.bonusTurns, 1000)
  assert.equal(derived.spawnArmor, 0, 'spawn armor belongs to combined modifiers, not derived stats')
  assert.equal(JSON.stringify(raw), beforeRaw)
  assert.deepEqual(effects.deriveCardPlayer(raw, held), derived, 'derivation is idempotent from raw base')
  assert.deepEqual(effects.deriveCardPlayer(raw, held.filter(item => item.def.cardClass === 'red')), raw, 'red mechanics never write player stats')

  const rng = createRng(2048)
  for (let i = 0; i < 1000; i++) {
    const ordinary = cards.pickUpgrades(rng)
    assert.equal(ordinary.length, 3)
    assert.equal(new Set(ordinary.map(def => def.id)).size, 3)
    assert.ok(ordinary.every(def => cards.NORMAL_CARD_CLASSES.includes(def.cardClass)))
    const golden = cards.pickUpgrades(rng, { count: 3, allowedClasses: ['gold'], hpRatio: 0.1 })
    assert.equal(golden.length, 3)
    assert.ok(golden.every(def => def.cardClass === 'gold'))
    const lowHp = cards.pickUpgrades(rng, { hpRatio: 0.2 })
    assert.equal(lowHp[0].kind, 'instant')
    const noHeal = cards.pickUpgrades(rng, { count: 100, hpRatio: 0.2, excludeHeal: true })
    assert.equal(noHeal.length, 30)
    assert.ok(noHeal.every(def => def.kind === 'persistent'))
  }
  assert.deepEqual(cards.pickUpgrades(rng, { allowedClasses: [] }), [])
  assert.deepEqual(cards.pickUpgrades(rng, { count: 0, hpRatio: 0.1 }), [])
  const risky = cards.pickUpgrades(rng, { allowedClasses: ['red'], count: 1000 })
  assert.equal(risky.length, 7)
  assert.ok(risky.every(def => def.cardClass === 'red'))
  const all = cards.pickUpgrades(rng, { allowedClasses: cards.CARD_CLASSES, count: 1000 })
  assert.equal(all.length, 47)
  const frequencies = { white: 0, blue: 0, gold: 0 }
  for (let i = 0; i < 10000; i++) frequencies[cards.pickUpgrades(rng, { count: 1 })[0].cardClass]++
  assert.ok(Math.abs(frequencies.white / 10000 - 0.6) < 0.025)
  assert.ok(Math.abs(frequencies.blue / 10000 - 0.3) < 0.025)
  assert.ok(Math.abs(frequencies.gold / 10000 - 0.1) < 0.025)
  let blueCount = 0
  for (let i = 0; i < 5000; i++) if (cards.pickUpgrades(rng, { count: 1, allowedClasses: ['blue', 'gold'] })[0].cardClass === 'blue') blueCount++
  assert.ok(Math.abs(blueCount / 5000 - 0.75) < 0.035, 'class weights normalize within allowed set')

  assert.equal(consumables.CONSUMABLE_POOL.length, 5)
  for (const item of consumables.CONSUMABLE_POOL) {
    assert.equal(consumables.consumableById(item.id), item)
    assert.equal(consumables.validateConsumable(item), true)
    assert.ok(['attack', 'defense', 'health', 'vitality', 'time', 'starting-tile', 'ward', 'weakness', 'wealth'].includes(item.icon), 'consumables use semantic image asset keys')
    assert.equal(consumables.consumableUseDisabledReason(item, 'battle', 'playing', true), item.cleanse ? '净化只能在路线、商店或营地进行' : null)
    for (const phase of ['round_delay', 'round_end', 'finish_delay', 'finished', null]) {
      assert.ok(consumables.consumableUseDisabledReason(item, 'battle', phase, true))
    }
    for (const screen of ['route', 'shop', 'rest']) {
      assert.equal(consumables.consumableUseDisabledReason(item, screen, null, true) === null, !!item.cleanse)
    }
    for (const screen of ['title', 'reward', 'event', 'meta', 'gameover', 'boss_choice']) {
      assert.ok(consumables.consumableUseDisabledReason(item, screen, null, true))
    }
  }
  const consumableExpectations = {
    tactical_potion: ['blue', 'round', 35, 'bonusTurns', 2],
    charge_potion: ['blue', 'round', 35, 'mergeCoefficient', 0.5],
    combo_scroll: ['gold', 'battle', 60, 'comboBonus', 8],
    berserk_potion: ['red', 'round', 45, 'burstCoefficient', 1],
  }
  for (const [id, [cardClass, duration, price, type, value]] of Object.entries(consumableExpectations)) {
    const item = consumables.consumableById(id)
    assert.deepEqual([item.cardClass, item.duration, item.price, item.effects[0].type, item.effects[0].value], [cardClass, duration, price, type, value])
  }
  const cleanse = consumables.consumableById('cleanse_potion')
  assert.equal(cleanse.price, 50)
  assert.equal(cleanse.duration, 'instant')
  assert.deepEqual(cleanse.effects, [])
  assert.ok(consumables.consumableUseDisabledReason(cleanse, 'route', null, false))
  assert.equal(consumables.validateConsumable({ ...clone(cleanse), cardClass: 'red' }), false)
  assert.equal(consumables.validateConsumable({ ...clone(cleanse), duration: 'round' }), false)

  // 独立旧版基准：原玩家池过滤后恰好十三项，按原次序、原数值逐次取整。
  const oldEnemy = [
    ['atk_up_1', '攻击强化', 'attack_multiplier', 0.2], ['def_up_1', '防御强化', 'defense_multiplier', 0.2],
    ['max_hp_1', '生命训练', 'max_hp', 10], ['spawn_red_1', '灵活身法', 'spawn_reduction', 0.1],
    ['max_hp_3', '生命强化', 'max_hp', 20], ['atk_up_2', '强力攻击', 'attack_multiplier', 0.35],
    ['def_up_2', '铜墙铁壁', 'defense_multiplier', 0.35], ['max_hp_2', '顽强生命', 'max_hp', 30],
    ['spawn_red_2_5', '灵巧闪避', 'spawn_reduction', 0.18], ['atk_up_3', '毁灭之力', 'attack_multiplier', 0.5],
    ['def_up_3', '不朽之盾', 'defense_multiplier', 0.5], ['spawn_red_2', '幻影步法', 'spawn_reduction', 0.25],
    ['max_hp_4', '不灭之躯', 'max_hp', 50],
  ]
  assert.deepEqual(enemies.ENEMY_UPGRADE_POOL.map(({ id, name, type, value }) => [id, name, type, value]), oldEnemy)
  assert.ok(Object.isFrozen(enemies.ENEMY_UPGRADE_POOL))
  assert.ok(enemies.ENEMY_UPGRADE_POOL.every(Object.isFrozen))
  const expectedStats = ids => {
    let atk = 27, def = 11, hp = 43
    for (const id of ids) {
      const trait = oldEnemy.find(item => item[0] === id)
      if (!trait) continue
      const [, , type, value] = trait
      if (type === 'attack_multiplier') atk = Math.floor(atk * (1 + value))
      if (type === 'defense_multiplier' || type === 'spawn_reduction') def = Math.floor(def * (1 + value))
      if (type === 'max_hp') hp = Math.floor(hp * (1 + value / 100))
    }
    return { atk, def, spd: 7, hp }
  }
  for (let seed = 1; seed <= 1000; seed++) {
    const stage = seed % 30 + 1
    const oldRng = createRng(seed)
    const pool = oldEnemy.map(item => item[0])
    const expectedIds = []
    for (let i = 0; i < stage - 1 && pool.length; i++) expectedIds.push(...pool.splice(Math.floor(oldRng() * pool.length), 1))
    const actualIds = enemies.assignEnemyUpgrades(stage, createRng(seed))
    assert.deepEqual(actualIds, expectedIds, `enemy draw baseline seed ${seed}`)
    assert.equal(new Set(actualIds).size, actualIds.length)
    assert.deepEqual(enemies.applyEnemyUpgradeStats(actualIds, 27, 11, 7, 43), expectedStats(expectedIds))
  }
  for (const [id, name, type, value] of oldEnemy) {
    assert.equal(enemies.getEnemyUpgradeName(id), name)
    const percentage = type === 'max_hp' ? value : value * 100
    const prefix = type === 'attack_multiplier' ? '攻击' : type === 'max_hp' ? '生命上限' : '防御'
    assert.equal(enemies.getEnemyUpgradeDescription(id), `${prefix}+${Number(percentage.toFixed(2))}%`)
  }
  assert.equal(enemies.getEnemyUpgradeDescription('atk_up_1'), '攻击+20%')
  assert.equal(enemies.getEnemyUpgradeDescription('spawn_red_1'), '防御+10%')
  assert.equal(enemies.getEnemyUpgradeDescription('max_hp_1'), '生命上限+10%')
  assert.deepEqual(enemies.applyEnemyUpgradeStats(['red_berserk', 'curse_burn', 'doom_soul', 'heal_1', 'gold_combo'], 27, 11, 7, 43), { atk: 27, def: 11, spd: 7, hp: 43 })
  const oldAttack = byId('atk_up_1').effects[0].value
  try {
    byId('atk_up_1').effects[0].value = 999
    assert.deepEqual(enemies.applyEnemyUpgradeStats(['atk_up_1'], 27, 11, 7, 43), expectedStats(['atk_up_1']), 'enemy registry does not inherit player definitions')
  } finally {
    byId('atk_up_1').effects[0].value = oldAttack
  }
}
