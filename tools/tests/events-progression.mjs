// 事件结算与无尽进度的纯逻辑回归：不依赖存档、不更新共享快照。
import assert from 'node:assert/strict'

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
  const enemies = loadProject('./core/enemy')
  const route = loadProject('./core/route')
  const { createRng } = loadProject('./core/random')
  const { pickEvent, resolveEventEffect, getEventChoiceDisabledReason, getReforgeEligibleItem, buildEventResult } = events
  const { ALL_EQUIPMENT, formatEquipStats } = equipment
  const { ENEMIES, generateProceduralEnemy, generateProceduralBoss, getBestiaryId, getEnemyIcon, getEnemiesForLayer } = enemies
  const catalog = new Map()
  for (let i = 0; i < 100; i++) {
    const event = pickEvent(3, () => (i + 0.5) / 100)
    catalog.set(event.id, event)
  }
  assert.equal(catalog.size, 10, 'all event definitions are reachable')
  const choice = (id, index) => catalog.get(id).choices[index].effect
  const getEq = id => ALL_EQUIPMENT.find(eq => eq.id === id.split(':')[0])
  const common = ALL_EQUIPMENT.filter(eq => eq.rarity === 'common' && eq.set).slice(0, 3)
  const worn = `${common[0].id}:1:100`
  const first = `${common[1].id}:5:90`
  const second = `${common[2].id}:1:110`
  const rich = { gold: 1000, inventory: [worn, first, second], equipment: { [common[0].slot]: worn } }

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
  for (let stage = 1; stage <= 3; stage++) {
    for (let i = 0; i < 100; i++) assert.ok(pickEvent(stage, () => i / 100).stageMin <= stage)
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

  // 全部选项都有纯数值结算与可读描述；装备描述必须包含实际名字和实际属性。
  const originalRandom = Math.random
  const originalNow = Date.now
  try {
    Math.random = () => { throw new Error('unseeded event/enemy RNG') }
    Date.now = () => { throw new Error('wall clock event/enemy RNG') }
    for (const event of catalog.values()) {
      for (const option of event.choices) {
        const before = JSON.stringify(option.effect)
        for (const roll of [0, 0.999999]) {
          const result = resolveEventEffect(option.effect, 3, () => roll, rich)
          assert.equal(getEventChoiceDisabledReason(result, rich), null)
          for (const [field, value] of Object.entries(result)) {
            if (['type', 'eqId', 'removeEqId'].includes(field)) assert.equal(typeof value, 'string')
            else assert.ok(typeof value === 'number' && Number.isFinite(value), `${result.type}.${field} must be a resolved number`)
          }
          const text = buildEventResult(result)
          assert.doesNotMatch(text, /不可思议|无法显示|数据不可用|永久|undefined|NaN/)
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

  // 敌人复用强化名称，但说明必须对应敌人实际属性算法，而非玩家回血或棋盘规则。
  const { getEnemyUpgradeDescription, applyEnemyUpgradeStats } = enemies
  for (const [id, expected] of [
    ['atk_up_1', '攻击+20%'], ['atk_up_2', '攻击+35%'], ['atk_up_3', '攻击+50%'],
    ['def_up_1', '防御+20%'], ['def_up_2', '防御+35%'], ['def_up_3', '防御+50%'],
    ['max_hp_1', '生命上限+10%'], ['max_hp_4', '生命上限+50%'],
    ['spawn_red_1', '防御+10%'], ['spawn_red_2_5', '防御+18%'], ['spawn_red_2', '防御+25%'],
    ['enemy_atk_1', '攻击-100%'],
  ]) assert.equal(getEnemyUpgradeDescription(id), expected)
  assert.doesNotMatch(getEnemyUpgradeDescription('max_hp_4'), /恢复|回复|治疗/)
  assert.doesNotMatch(getEnemyUpgradeDescription('spawn_red_2'), /棋盘|上限|生成/)
  assert.deepEqual(applyEnemyUpgradeStats(['max_hp_4'], 100, 100, 8, 200), { atk: 100, def: 100, spd: 8, hp: 300 }, '50 means +50% enemy HP, not a flat +50 or heal')
  assert.deepEqual(applyEnemyUpgradeStats(['spawn_red_2'], 100, 100, 8, 200), { atk: 100, def: 125, spd: 8, hp: 200 }, 'spawn reduction instead multiplies enemy defense by 1.25')
  assert.deepEqual(applyEnemyUpgradeStats(['atk_up_2', 'def_up_2'], 100, 100, 8, 200), { atk: 135, def: 135, spd: 8, hp: 200 })
  for (const id of ['', 'unknown_upgrade']) assert.equal(getEnemyUpgradeDescription(id), '未知敌人强化')
  for (const id of ['heal_1', 'bonus_turn_1', 'start_tile_1', 'gold_1']) {
    assert.equal(getEnemyUpgradeDescription(id), '该强化不改变敌人属性', 'unsupported enemy effects must not reuse player descriptions')
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
