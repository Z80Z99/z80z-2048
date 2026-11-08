// 事件结算与无尽进度的纯逻辑回归：不依赖存档、不更新共享快照。
import assert from 'node:assert/strict'
import { EXPANSION_CONTRACTS, assertExpansionContracts } from './events-expansion.mjs'

function sequence(...values) {
  let index = 0
  return () => values[index++] ?? 0.5
}

function goldAfter(gold, effect) {
  if (effect.type === 'gold') return gold + effect.value
  if (effect.type === 'drop_equip') return gold - effect.cost
  if (effect.type === 'reforge') return gold + effect.gold - effect.cost
  return gold
}

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const events = loadProject('./core/events')
  const equipment = loadProject('./core/equipment')
  const cards = loadProject('./core/upgrade')
  const consumables = loadProject('./core/consumables')
  const enemies = loadProject('./core/enemy')
  const route = loadProject('./core/route')
  const { createRng } = loadProject('./core/random')
  const { pickEvent, resolveEventEffect, getEventChoiceDisabledReason, getEventRequiresBlackConfirmation, getReforgeEligibleItem, buildEventResult } = events
  const { ALL_EQUIPMENT, formatEquipStats } = equipment
  const { ENEMIES, generateProceduralEnemy, generateProceduralBoss, getBestiaryId, getEnemyIcon, getEnemiesForLayer } = enemies
  const catalog = new Map()
  for (let i = 0; i < 100; i++) {
    const event = pickEvent(3, () => (i + 0.5) / 100)
    catalog.set(event.id, event)
  }
  assert.equal(catalog.size, 25, 'all fifteen existing and ten expansion event definitions are reachable')
  const legacyCatalog = new Map([...catalog].filter(([id]) => !EXPANSION_CONTRACTS.has(id)))
  assert.equal(legacyCatalog.size, 15, 'all ten legacy and five sixcolor event definitions remain reachable')
  assert.deepEqual([...legacyCatalog.keys()].sort(), [
    'treasure_chest', 'healing_fountain', 'dark_shrine', 'fallen_warrior', 'gambler',
    'ancient_scroll', 'spike_trap', 'mysterious_box', 'dying_merchant', 'ancient_anvil',
    'risk_shrine', 'cursed_archive', 'alchemy_supply', 'abyss_contract', 'cleansing_hermit',
  ].sort(), 'new events supplement, not replace, the existing event outcomes')
  assertExpansionContracts(catalog, loadProject)
  const choice = (id, index) => catalog.get(id).choices[index].effect
  const getEq = id => ALL_EQUIPMENT.find(eq => eq.id === id.split(':')[0])
  const common = ALL_EQUIPMENT.filter(eq => eq.rarity === 'common' && eq.set).slice(0, 3)
  const worn = `${common[0].id}:1:100`
  const first = `${common[1].id}:5:90`
  const second = `${common[2].id}:1:110`
  const rich = { gold: 1000, inventory: [worn, first, second], equipment: { [common[0].slot]: worn }, purpleLayers: 2 }

  // 数据文案必须如实反映实际机制，每个选项都解释其结果。
  for (const event of catalog.values()) {
    const text = JSON.stringify(event)
    assert.doesNotMatch(text, /不详|永久|半价|可欠债|稀有以上|损失\s*\d+\s*步|跳过一次地图移动/)
    for (const option of event.choices) assert.ok(option.tooltip, `${event.id}: missing consequence text`)
  }
  assert.match(catalog.get('dark_shrine').desc, /不祥/)
  assert.match(catalog.get('dark_shrine').choices[1].tooltip, /基础生命上限/)
  assert.match(catalog.get('ancient_anvil').choices[1].tooltip, /背包中首件/)
  assert.doesNotMatch(JSON.stringify(catalog.get('ancient_scroll')), /后悔|似乎|风险/)
  for (const [stage, expectedCount] of [[1, 9], [2, 19], [3, 25], [4, 25]]) {
    const stageIds = new Set()
    for (let i = 0; i < 100; i++) {
      const event = pickEvent(stage, () => (i + 0.5) / 100)
      assert.ok(event.stageMin <= stage)
      stageIds.add(event.id)
    }
    assert.equal(stageIds.size, expectedCount, `stage ${stage}: exact available event count`)
  }

  // 精确分层样本验证 50% / 70%，不使用不稳定的统计阈值。
  for (const [index, probability, stake, rarity] of [[0, 50, 20, 'rare'], [1, 70, 5, 'common']]) {
    const gamble = choice('gambler', index)
    let wins = 0
    for (let i = 0; i < 100; i++) {
      const result = resolveEventEffect(gamble, 3, sequence((i + 0.5) / 100), { gold: stake })
      if (result.type === 'drop_equip') {
        wins++
        assert.equal(getEq(result.eqId)?.rarity, rarity)
        assert.equal(result.cost, stake)
        assert.deepEqual(Object.keys(result).sort(), ['cost', 'eqId', 'type'])
        assert.match(buildEventResult(result), new RegExp(`支付 ${stake} 金币`))
      } else {
        assert.deepEqual(result, { type: 'gold', value: -stake }, 'loss must not also carry a second cost')
      }
      assert.equal(goldAfter(stake, result), 0, 'exactly one stake charged on both outcomes')
      assert.equal(getEventChoiceDisabledReason(result, { gold: stake }), null)
      assert.match(getEventChoiceDisabledReason(result, { gold: stake - 1 }), /金币不足/)
    }
    assert.equal(wins, probability)
    assert.equal(resolveEventEffect(gamble, 2, sequence(probability / 100 - 0.000001), rich).type, 'drop_equip')
    assert.deepEqual(resolveEventEffect(gamble, 2, sequence(probability / 100), rich), { type: 'gold', value: -stake })
    for (const context of [{}, { gold: stake - 1 }, { gold: -1 }, { gold: NaN }]) {
      let calls = 0
      assert.match(getEventChoiceDisabledReason(gamble, context), /金币不足/)
      assert.throws(() => resolveEventEffect(gamble, 2, () => { calls++; return 0 }, context), /金币不足/)
      assert.equal(calls, 0, 'unaffordable preview must not consume RNG')
    }
  }

  const fountain = choice('healing_fountain', 0)
  let curses = 0
  for (let i = 0; i < 100; i++) {
    const result = resolveEventEffect(fountain, 1, () => (i + 0.5) / 100)
    if (result.type === 'heal_curse') {
      curses++
      assert.deepEqual(result, { type: 'heal_curse', heal: 30, curse_hp: 10 })
      assert.match(buildEventResult(result), /先.*30%.*随后.*基础生命上限.*10%/)
    } else assert.deepEqual(result, { type: 'heal', value: 30 })
  }
  assert.equal(curses, 30)
  assert.deepEqual(resolveEventEffect(fountain, 1, () => 0.3), { type: 'heal', value: 30 })
  assert.deepEqual(resolveEventEffect(choice('dying_merchant', 0), 3, () => 0), { type: 'gold_heal', heal: 10, gold: 5 })
  assert.deepEqual(resolveEventEffect(choice('dying_merchant', 0), 3, () => 0.999999), { type: 'gold_heal', heal: 10, gold: 10 })
  assert.deepEqual(resolveEventEffect(choice('spike_trap', 0), 2, () => { throw new Error('no-op RNG') }), { type: 'none' })
  assert.deepEqual(resolveEventEffect(choice('spike_trap', 1), 2, sequence(0, 0.49)), { type: 'gold', value: 15 })
  assert.deepEqual(resolveEventEffect(choice('spike_trap', 1), 2, sequence(0.999999, 0.5)), { type: 'hp_reduce', value: 15 })
  assert.deepEqual(resolveEventEffect(choice('spike_trap', 2), 2, () => 0.699999), { type: 'none' })
  assert.deepEqual(resolveEventEffect(choice('spike_trap', 2), 2, () => 0.7), { type: 'hp_reduce', value: 25 })
  assert.deepEqual(resolveEventEffect({ type: 'sprint', safe: 0, hp_dmg: 25 }, 2, () => 0), { type: 'hp_reduce', value: 25 })
  assert.deepEqual(resolveEventEffect(choice('ancient_scroll', 0), 2, () => 0.999999), { type: 'xp', value: 50 })
  assert.deepEqual(resolveEventEffect(choice('dark_shrine', 0), 1, () => 0), { type: 'hp_reduce_pct', value: 20, atk_mult: 0.08, def_mult: 0 })
  assert.deepEqual(resolveEventEffect(choice('dark_shrine', 1), 1, () => 0), { type: 'maxhp_down_pct', value: 15, atk_mult: 0, def_mult: 0.12 })

  const forge = choice('ancient_anvil', 0)
  assert.equal(forge.cost, 25)
  assert.match(getEventChoiceDisabledReason(forge, { gold: 24 }), /25/)
  assert.equal(getEventChoiceDisabledReason(forge, { gold: 25 }), null)
  const forged = resolveEventEffect(forge, 3, () => 0, { gold: 25 })
  assert.equal(forged.cost, 25)
  assert.equal(getEq(forged.eqId)?.rarity, 'epic')
  assert.equal(goldAfter(25, forged), 0)
  assert.match(buildEventResult(forged), /支付 25 金币/)
  const free = resolveEventEffect(choice('mysterious_box', 0), 3, () => 0)
  assert.equal(free.cost, 0)
  assert.equal(getEq(free.eqId)?.rarity, 'rare')

  const reforge = choice('ancient_anvil', 1)
  const contextBefore = JSON.stringify(rich)
  assert.equal(getReforgeEligibleItem(rich), first, 'skip equipped item and take first eligible inventory entry')
  assert.equal(getEventChoiceDisabledReason(reforge, rich), null)
  const replacement = resolveEventEffect(reforge, 3, () => 0, rich)
  assert.equal(replacement.removeEqId, first)
  assert.equal(replacement.cost, 0)
  assert.equal(replacement.gold, 15)
  assert.equal(goldAfter(0, replacement), 15)
  assert.equal(getEq(replacement.eqId)?.rarity, 'rare')
  assert.deepEqual(Object.keys(replacement).sort(), ['cost', 'eqId', 'gold', 'removeEqId', 'type'])
  assert.equal(resolveEventEffect(reforge, 3, () => 0.999999, rich).gold, 25)
  assert.equal(JSON.stringify(rich), contextBefore, 'preflight/resolution must not mutate player inventory or gold')
  assert.equal(getReforgeEligibleItem({ ...rich, inventory: [second, first, worn] }), second, 'inventory order, not equipment level or age guesses')
  const sorted = { ...rich, inventory: [second, first, worn] }
  assert.equal(getEventChoiceDisabledReason(replacement, sorted), null, 'sorting does not invalidate recorded item')
  assert.equal(resolveEventEffect(replacement, 3, () => { throw new Error('cached RNG') }, sorted).removeEqId, first)
  const removed = { ...rich, inventory: [worn, second] }
  const nowEquipped = { ...rich, equipment: { ...rich.equipment, [common[1].slot]: first } }
  for (const context of [removed, nowEquipped]) {
    assert.equal(getEventChoiceDisabledReason(reforge, context), null, 'other common items remain available')
    assert.match(getEventChoiceDisabledReason(replacement, context), /未装备普通装备/, 'cannot silently switch cached removal target')
    assert.throws(() => resolveEventEffect(replacement, 3, () => 0, context), /未装备普通装备/)
  }
  for (const context of [{}, { inventory: [worn], equipment: { pants: worn } }, { inventory: [free.eqId, 'unknown:1:100'] }]) {
    assert.equal(getReforgeEligibleItem(context), null)
    assert.match(getEventChoiceDisabledReason(reforge, context), /未装备普通装备/)
    assert.throws(() => resolveEventEffect(reforge, 3, () => { throw new Error('unexpected RNG') }, context), /未装备普通装备/)
  }
  const duplicatesWorn = { inventory: [worn, worn], equipment: { pants: worn } }
  assert.equal(getReforgeEligibleItem(duplicatesWorn), null, 'ambiguous duplicate equipped IDs are excluded conservatively')
  const legacyItem = 'eq_noset__boots_common:1:100'
  const legacyContext = { inventory: [legacyItem], equipment: {}, gold: 0 }
  assert.equal(getReforgeEligibleItem(legacyContext), legacyItem, 'equipment compatibility lookup also supports legacy common items')
  const legacyReplacement = resolveEventEffect(reforge, 3, () => 0, legacyContext)
  assert.equal(legacyReplacement.removeEqId, legacyItem)
  assert.ok(buildEventResult(legacyReplacement).includes(equipment.equipmentById(legacyItem).name))

  // 不再对坏数据静默给金币、返回空装备、消耗隐形资源。
  const invalid = [
    { type: 'unknown_event' }, { type: 'gold', value: { min: 10, max: 1 } },
    { type: 'gold', value: NaN }, { type: 'gold', value: 10, cost: 5 },
    { type: 'drop_equip', rarity: 'mythic' }, { type: 'drop_equip', eqId: '' },
    { type: 'drop_equip', cost: -1 }, { type: 'drop_equip', cost: NaN },
    { type: 'gamble', cost: 20, win_chance: 101 }, { type: 'heal', value: 30, curse: 30 },
    { type: 'reforge', eqId: free.eqId, gold: 20, cost: 0 },
  ]
  for (const effect of invalid) {
    assert.equal(typeof getEventChoiceDisabledReason(effect, rich), 'string')
    assert.throws(() => resolveEventEffect(effect, 3, () => { throw new Error('unexpected RNG') }, rich), error => !error.message.includes('unexpected RNG'))
  }
  assert.match(getEventChoiceDisabledReason({ type: 'gold', value: { min: -20, max: -10 } }, { gold: 19 }), /20/)
  assert.throws(() => resolveEventEffect({ type: 'none' }, 0, () => 0), /正整数/)

  // 陨落战士曾把散件攻击百分比显示成固定值；掉落与重铸均须复用面板的完整词条。
  const cloudBoots = 'eq_noset_cloud_boots_boots_common:1:104'
  const cloudLabels = formatEquipStats(cloudBoots)
  assert.deepEqual(cloudLabels, ['攻击+12%', '速度+4'])
  for (const effect of [
    { type: 'drop_equip', eqId: cloudBoots, cost: 0 },
    { type: 'reforge', removeEqId: cloudBoots, eqId: forged.eqId, gold: 15, cost: 0 },
  ]) {
    const text = buildEventResult(effect)
    for (const label of cloudLabels) assert.ok(text.includes(label), `missing exact equipment label: ${label}`)
    assert.ok(text.includes(`（${cloudLabels.join('，')}）`), 'equipment stat block matches the shared formatter exactly')
  }

  // 十个旧事件仍是扁平数值结算；四个新交易使用结构化、精确 ID 奖励。
  const tradeEvents = new Map([
    ['risk_shrine', { count: 5, allowedClasses: ['red'], requiredClass: 'red', cost: 0 }],
    ['cursed_archive', { count: 5, allowedClasses: ['gold', 'purple'], requiredClass: 'purple', cost: 0 }],
    ['alchemy_supply', { count: 1, allowedClasses: [], cost: 35 }],
    ['abyss_contract', { count: 3, allowedClasses: ['gold', 'black'], requiredClass: 'black', cost: 0 }],
    ['cleansing_hermit', { count: 1, allowedClasses: [], cost: 40 }],
  ])
  for (const [id, contract] of tradeEvents) {
    const event = catalog.get(id)
    const trades = event.choices.filter(option => option.effect.type === 'card_trade')
    const leaves = event.choices.filter(option => option.effect.type === 'none')
    assert.equal(trades.length, contract.count, `${id}: all approved trade variants are reachable`)
    assert.equal(leaves.length, 1, `${id}: voluntary safe leave remains available`)
    assert.equal(event.choices.length, trades.length + leaves.length)
    assert.deepEqual(resolveEventEffect(leaves[0].effect, 3, () => { throw new Error('safe leave consumed RNG') }), { type: 'none' })
    assert.match(leaves[0].tooltip, /无消耗.*无奖励/)
    if (contract.requiredClass) {
      const offered = new Set(trades.flatMap(option => option.effect.grants.map(grant => grant.id)))
      const required = cards.UPGRADE_POOL.filter(def => def.cardClass === contract.requiredClass).map(def => def.id)
      assert.deepEqual([...offered].filter(id => cards.cardById(id).cardClass === contract.requiredClass).sort(), required.sort(), `${id}: every risk/curse/doom card is obtainable`)
    }
  }
  const originalRandom = Math.random
  const originalNow = Date.now
  try {
    Math.random = () => { throw new Error('unseeded event/enemy RNG') }
    Date.now = () => { throw new Error('wall clock event/enemy RNG') }
    // 原15事件继续完整执行既有精确断言；扩展事件不套用旧零hpCost/gold假设，改由独立契约验证。
    assertExpansionContracts(catalog, loadProject)
    for (const event of legacyCatalog.values()) {
      for (const option of event.choices) {
        const before = JSON.stringify(option.effect)
        for (const roll of [0, 0.999999]) {
          const result = resolveEventEffect(option.effect, 3, () => roll, rich)
          assert.equal(getEventChoiceDisabledReason(result, rich), null)
          if (option.effect.type === 'card_trade') {
            assert.equal(result.type, 'card_trade')
            const eventContract = tradeEvents.get(event.id)
            assert.ok(eventContract, `${event.id}: explicit trade contract`)
            const source = option.effect
            assert.ok(Array.isArray(source.grants), 'each raw choice provides its own exact grant list')
            const contract = { cardGrants: source.grants.map(({ id, count }) => ({ id, count })), cost: source.cost ?? 0 }
            if (source.consumableGrants !== undefined) contract.consumableGrants = source.consumableGrants.map(({ id, count }) => ({ id, count }))
            assert.equal(contract.cost, eventContract.cost, 'variant retains approved event price')
            assert.equal(source.gold ?? 0, 0)
            assert.equal(source.hpCost ?? 0, 0)
            const grantClasses = contract.cardGrants.map(grant => cards.cardById(grant.id)?.cardClass)
            assert.ok(grantClasses.every(cardClass => eventContract.allowedClasses.includes(cardClass)), 'each trade stays in its approved classes')
            if (eventContract.requiredClass) {
              assert.ok(grantClasses.includes(eventContract.requiredClass), 'no variant omits its required risk, curse or doom cost')
              if (event.id !== 'risk_shrine') assert.ok(grantClasses.includes('gold'), 'curse/doom trade retains its gold benefit')
            }
            if (event.id === 'alchemy_supply') assert.deepEqual(contract.consumableGrants, [{ id: 'tactical_potion', count: 1 }])
            else assert.ok(!Object.hasOwn(contract, 'consumableGrants'), 'risk trades do not silently add consumables')
            const requiresBlackConfirmation = grantClasses.includes('black')
            assert.deepEqual(result, { type: 'card_trade', ...contract, gold: 0, hpCost: 0, removesPurple: source.removesPurple ?? 0, requiresBlackConfirmation }, 'cached grant IDs, counts and expenses are exact')
            assert.deepEqual(Object.keys(result).sort(), [
              'type', 'cardGrants', 'cost', 'gold', 'hpCost', 'removesPurple', 'requiresBlackConfirmation',
              ...(contract.consumableGrants ? ['consumableGrants'] : []),
            ].sort(), 'cached trade has no raw grant list or unresolved fields')
            for (const field of ['cost', 'gold', 'hpCost']) assert.ok(typeof result[field] === 'number' && Number.isFinite(result[field]))
            for (const [field, lookup] of [['cardGrants', cards.cardById], ['consumableGrants', consumables.consumableById]]) {
              for (const grant of result[field] ?? []) {
                assert.deepEqual(Object.keys(grant).sort(), ['count', 'id'])
                assert.ok(Number.isSafeInteger(grant.count) && grant.count > 0)
                assert.equal(lookup(grant.id)?.id, grant.id, 'grant uses an exact registered ID')
              }
            }
            assert.equal(getEventRequiresBlackConfirmation(option.effect), requiresBlackConfirmation)
            assert.equal(getEventRequiresBlackConfirmation(result), requiresBlackConfirmation)
            const noRng = () => { throw new Error('cached trade consumed RNG') }
            assert.deepEqual(resolveEventEffect(result, 3, noRng, rich), result, 'cached trade resolves identically without rerolling')
            assert.equal(resolveEventEffect({ ...result, requiresBlackConfirmation: !requiresBlackConfirmation }, 3, noRng, rich).requiresBlackConfirmation, requiresBlackConfirmation, 'confirmation is derived from black grants, not trusted flags')
            assert.notEqual(result.cardGrants, option.effect.grants, 'cached grants do not alias source arrays')
            result.cardGrants.forEach((grant, index) => assert.notEqual(grant, option.effect.grants[index]))
            if (result.consumableGrants) {
              assert.notEqual(result.consumableGrants, option.effect.consumableGrants)
              result.consumableGrants.forEach((grant, index) => assert.notEqual(grant, option.effect.consumableGrants[index]))
            }
          } else {
            for (const [field, value] of Object.entries(result)) {
              if (['type', 'eqId', 'removeEqId'].includes(field)) assert.equal(typeof value, 'string')
              else assert.ok(typeof value === 'number' && Number.isFinite(value), `${result.type}.${field} must be a resolved number`)
            }
          }
          const text = buildEventResult(result)
          assert.doesNotMatch(text, /不可思议|无法显示|数据不可用|永久|undefined|NaN/)
          if (result.type === 'card_trade') {
            assert.equal(option.tooltip, text, `${event.id}: every variant tooltip describes its exact cached outcome`)
            for (const [field, lookup, validate] of [
              ['cardGrants', cards.cardById, cards.validateCard],
              ['consumableGrants', consumables.consumableById, consumables.validateConsumable],
            ]) {
              for (const grant of result[field] ?? []) {
                const def = lookup(grant.id)
                assert.ok(validate(def), `${grant.id}: valid complete grant definition`)
                assert.ok(text.includes(def.name) && text.includes(cards.cardClassText(def.cardClass)))
                assert.ok(text.includes(`×${grant.count}`), 'description states actual grant count')
                for (const effect of def.effects) {
                  assert.ok(text.includes(cards.cardEffectText(effect)), 'description states every positive and negative effect')
                  assert.ok(text.includes(effect.polarity === 'positive' ? '正面收益（+）' : '负面代价（−）'))
                }
                if (field === 'consumableGrants') assert.match(text, /获得时不自动使用.*使用消耗 1 份/)
                else if (def.cardClass === 'purple') assert.match(text, /普通商店不能移除，可用净化药剂或奇遇移除/)
                else if (def.cardClass === 'black') assert.match(text, /本局无法移除，商店与净化均无效/)
              }
            }
            if (result.requiresBlackConfirmation) assert.match(text, /额外确认.*确认前取消/)
          }
          for (const field of ['eqId', 'removeEqId']) {
            if (!result[field]) continue
            assert.ok(text.includes(getEq(result[field]).name))
            const labels = formatEquipStats(result[field])
            for (const label of labels) assert.ok(text.includes(label), `show exact shared equipment label: ${label}`)
            assert.ok(text.includes(`（${labels.join('，')}）`), 'show equipment stats with identical labels and units')
          }
        }
        assert.equal(JSON.stringify(option.effect), before, 'event definition must not be mutated')
      }
    }
    for (const effect of [forge, reforge, choice('gambler', 1)]) {
      const a = resolveEventEffect(effect, 3, createRng(8291), rich)
      const b = resolveEventEffect(effect, 3, createRng(8291), rich)
      assert.deepEqual(a, b, 'same RNG seed includes equipment fluctuation and identity')
      assert.equal(buildEventResult(a), buildEventResult(b))
    }
    generateProceduralEnemy(40, 10, false, createRng(72))
    generateProceduralBoss(40, createRng(72))
    route.generateRoute(createRng(72), 4)
  } finally {
    Math.random = originalRandom
    Date.now = originalNow
  }

  // 无尽种族有独立、稳定且可在图鉴发现的 ID，保留模板 HP/攻击/防御缩放。
  assert.equal(new Set(ENEMIES.map(enemy => enemy.id)).size, ENEMIES.length)
  const endless = ENEMIES.filter(enemy => enemy.id.startsWith('endless_'))
  const endlessBosses = ENEMIES.filter(enemy => enemy.id.startsWith('boss_endless_'))
  assert.equal(endless.length, 20)
  assert.equal(endlessBosses.length, 8)
  const generatedIds = new Set()
  for (const [elite, templates] of [[false, endless.slice(0, 15)], [true, endless.slice(15)]]) {
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i]
      const pick = (i + 0.5) / templates.length
      let calls = 0
      const early = generateProceduralEnemy(4, 1, elite, () => { calls++; return pick })
      assert.equal(calls, 1, 'species ID no longer spends an extra RNG draw')
      assert.equal(early.id, template.id)
      assert.equal(early.name, template.name)
      generatedIds.add(early.id)
      for (const [stage, layer] of [[4, 1], [5, 10], [40, 5], [200, 10]]) {
        const enemy = generateProceduralEnemy(stage, layer, elite, () => pick)
        const scale = 1 + (stage - 3) * 0.35 + layer * 0.02
        assert.equal(enemy.id, early.id, 'species identity does not depend on stage/layer')
        assert.equal(enemy.hp, Math.floor(template.hp * scale))
        assert.equal(enemy.maxHp, enemy.hp)
        assert.equal(enemy.attack, Math.floor(template.attack * scale))
        assert.equal(enemy.defense, Math.floor(template.defense * scale))
        const raw = template.speed * scale
        assert.equal(enemy.speed, Math.floor(raw <= 24 ? raw : 24 + Math.sqrt(raw - 24)))
      }
    }
  }
  assert.equal(generatedIds.size, 20, 'normal and elite species never share identity')
  for (let index = 0; index < 8; index++) {
    const stage = 4 + index
    const boss = generateProceduralBoss(stage, () => { throw new Error('boss RNG') })
    const nextCycle = generateProceduralBoss(stage + 8, () => 0)
    assert.equal(boss.id, endlessBosses[index].id)
    assert.equal(nextCycle.id, boss.id)
    assert.equal(getBestiaryId(`boss_endless_${stage}`), boss.id)
    assert.equal(getBestiaryId(`boss_endless_${stage + 8}`), boss.id)
    const scale = 1 + (stage - 3) * 0.4
    assert.equal(boss.hp, Math.floor(250 * scale))
    assert.equal(boss.attack, Math.floor(60 * scale))
    assert.equal(boss.defense, Math.floor(24 * scale))
    const raw = 16 * scale
    assert.equal(boss.speed, Math.floor(raw <= 24 ? raw : 24 + Math.sqrt(raw - 24)))
  }
  for (const id of ['rat', 'endless_4_1_1234', 'endless_4_1_5678', 'boss_endless_3', 'boss_endless_04', 'boss_endless_4_extra', 'boss_endless_9007199254740992', 'unknown']) {
    assert.equal(getBestiaryId(id), id, `cannot infer species from ${id}: preserve legacy key`)
  }
  for (const enemy of ENEMIES) {
    assert.equal(getBestiaryId(enemy.id), enemy.id)
    assert.equal(getEnemyIcon(enemy), getEnemyIcon(enemy.id))
    assert.ok(getEnemyIcon(enemy.id).length > 0)
  }
  assert.notEqual(getEnemyIcon('rat'), getEnemyIcon('boss_dragon'), 'semantic icons are not one generic tier icon')
  assert.ok(getEnemyIcon('unknown').length > 0)
  assert.equal(getEnemyIcon('boss_endless_4'), getEnemyIcon('boss_endless_void_master'))
  assert.ok(generateProceduralEnemy(200, 10, false, () => 0).speed > generateProceduralEnemy(40, 10, false, () => 0).speed)
  assert.ok(generateProceduralBoss(200, () => 0).speed > generateProceduralBoss(40, () => 0).speed)
  assert.equal(enemies.ROUND_SPD_BONUS, 1, 'round speed can keep rising after procedural softcap')

  // 敌人独立冻结旧十三种强化及其顺序、名称和数值，不借用玩家同名新卡。
  const { ENEMY_UPGRADE_POOL, getEnemyUpgradeName, getEnemyUpgradeDescription, applyEnemyUpgradeStats } = enemies
  const frozenEnemyContracts = [
    ['atk_up_1', '攻击强化', 'attack_multiplier', 0.2, '攻击+20%'],
    ['def_up_1', '防御强化', 'defense_multiplier', 0.2, '防御+20%'],
    ['max_hp_1', '生命训练', 'max_hp', 10, '生命上限+10%'],
    ['spawn_red_1', '灵活身法', 'spawn_reduction', 0.1, '防御+10%'],
    ['max_hp_3', '生命强化', 'max_hp', 20, '生命上限+20%'],
    ['atk_up_2', '强力攻击', 'attack_multiplier', 0.35, '攻击+35%'],
    ['def_up_2', '铜墙铁壁', 'defense_multiplier', 0.35, '防御+35%'],
    ['max_hp_2', '顽强生命', 'max_hp', 30, '生命上限+30%'],
    ['spawn_red_2_5', '灵巧闪避', 'spawn_reduction', 0.18, '防御+18%'],
    ['atk_up_3', '毁灭之力', 'attack_multiplier', 0.5, '攻击+50%'],
    ['def_up_3', '不朽之盾', 'defense_multiplier', 0.5, '防御+50%'],
    ['spawn_red_2', '幻影步法', 'spawn_reduction', 0.25, '防御+25%'],
    ['max_hp_4', '不灭之躯', 'max_hp', 50, '生命上限+50%'],
  ]
  assert.deepEqual(ENEMY_UPGRADE_POOL, frozenEnemyContracts.map(([id, name, type, value]) => ({ id, name, type, value })), 'exact old thirteen-entry enemy pool remains independent')
  assert.ok(Object.isFrozen(ENEMY_UPGRADE_POOL) && ENEMY_UPGRADE_POOL.every(Object.isFrozen))
  for (const [id, name, , , description] of frozenEnemyContracts) {
    assert.equal(getEnemyUpgradeName(id), name)
    assert.equal(getEnemyUpgradeDescription(id), description)
  }
  assert.equal(cards.cardById('atk_up_1').effects[0].value, 0.08, 'player same-ID card uses its redesigned value')
  assert.equal(getEnemyUpgradeDescription('atk_up_1'), '攻击+20%', 'player value does not leak into enemy description')
  assert.doesNotMatch(getEnemyUpgradeDescription('max_hp_4'), /恢复|回复|治疗/)
  assert.doesNotMatch(getEnemyUpgradeDescription('spawn_red_2'), /棋盘|上限|生成/)
  assert.deepEqual(applyEnemyUpgradeStats(['max_hp_4'], 100, 100, 8, 200), { atk: 100, def: 100, spd: 8, hp: 300 }, '50 means +50% enemy HP, not a flat +50 or heal')
  assert.deepEqual(applyEnemyUpgradeStats(['spawn_red_2'], 100, 100, 8, 200), { atk: 100, def: 125, spd: 8, hp: 200 }, 'spawn reduction instead multiplies enemy defense by 1.25')
  assert.deepEqual(applyEnemyUpgradeStats(['atk_up_2', 'def_up_2'], 100, 100, 8, 200), { atk: 135, def: 135, spd: 8, hp: 200 })
  for (const id of ['', 'unknown_upgrade', 'enemy_atk_1', 'heal_1', 'bonus_turn_1', 'start_tile_1', 'gold_1', 'red_berserk', 'curse_burn', 'doom_soul']) {
    assert.equal(getEnemyUpgradeName(id), '未知敌人强化')
    assert.equal(getEnemyUpgradeDescription(id), '未知敌人强化', 'outside frozen registry: never reuse player names or effects')
    assert.deepEqual(applyEnemyUpgradeStats([id], 100, 100, 8, 200), { atk: 100, def: 100, spd: 8, hp: 200 })
  }

  // 权重有意改动：同一对物种，后解锁/早解锁的相对概率随深度增加。
  function sampleLayer(layer, count) {
    const counts = new Map()
    for (let i = 0; i < count; i++) {
      const id = getEnemiesForLayer(1, layer, false, () => (i + 0.5) / count).id
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }
  const shallow = sampleLayer(1, 200)
  assert.deepEqual([...shallow.entries()], [['rat', 100], ['slime', 100]], 'first layer remains uniform and gated')
  const middle = sampleLayer(4, 1200)
  for (const locked of ['spider', 'slime_large', 'bone_archer', 'mud_golem', 'cave_troll']) assert.ok(!middle.has(locked))
  const layer7 = sampleLayer(7, 10400)
  const layer10 = sampleLayer(10, 46000)
  assert.equal(layer7.get('cave_troll') / layer7.get('rat'), 5)
  assert.equal(layer10.get('cave_troll') / layer10.get('rat'), 7)
  assert.equal(layer10.get('rat'), 1000)
  assert.equal(layer10.get('cave_troll'), 7000)

  // 遭遇实例仍由路线节点唯一标识；节点只连接实际可通行的下一层路线。
  for (const stage of [1, 4]) {
    let calls = 0
    const nodes = route.generateRoute(() => { calls++; return 0.2 }, stage)
    assert.equal(calls, stage === 1 ? 24 : 33, 'event nodes spend no enemy/upgrade RNG')
    assert.equal(nodes.filter(node => node.type === 'event').length, 15)
    assert.equal(new Set(nodes.map(node => node.id)).size, nodes.length)
    for (const node of nodes) {
      const isCombat = ['battle', 'elite', 'boss'].includes(node.type)
      assert.equal(node.enemy !== null, isCombat)
      if (node.enemy) assert.ok(ENEMIES.some(enemy => enemy.id === node.enemy.id))
      const nextLayer = nodes.filter(next => next.layer === node.layer + 1)
      assert.equal(new Set(node.nextIds).size, node.nextIds.length)
      assert.ok(node.nextIds.every(id => nextLayer.some(next => next.id === id)))
      assert.ok(nextLayer.length ? node.nextIds.length >= 1 && node.nextIds.length <= 2 : node.nextIds.length === 0)
    }
    if (stage === 4) {
      assert.equal(nodes[0].enemy.id, nodes[1].enemy.id)
      assert.notEqual(nodes[0].id, nodes[1].id, 'same species can have distinct encounters')
    }
  }
}
