// 事件结算与无尽进度的纯逻辑回归：不依赖存档、不更新共享快照。
import assert from 'node:assert/strict'

function sequence(...values) {
  let index = 0
  return () => values[index++] ?? 0.5
}

// 满资源上下文：三档全可行，分支抽签直接按权重切分。
const rich = () => ({ gold: 1000, hp: 100, inventory: ['eq_tempest_pants_common:1:100', 'eq_fortress_gloves_common:2:110'], equipment: { helmet: 'eq_holy_helmet_common:1:100' }, purpleLayers: 2 })
const broke = () => ({ gold: 0, hp: 1, inventory: [], equipment: {}, purpleLayers: 0 })

function tierLabel(choice, roll) {
  let acc = 0
  for (const [index, outcome] of choice.outcomes.entries()) {
    acc += outcome.weight
    if (roll * 100 < acc) return { index, label: outcome.label, tone: outcome.tone }
  }
  const last = choice.outcomes[choice.outcomes.length - 1]
  return { index: choice.outcomes.length - 1, label: last.label, tone: last.tone }
}

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const events = loadProject('./core/events')
  const equipment = loadProject('./core/equipment')
  const cards = loadProject('./core/upgrade')
  const enemies = loadProject('./core/enemy')
  const route = loadProject('./core/route')
  const { createRng } = loadProject('./core/random')
  const { pickEvent, resolveEventEffect, resolveEventOutcome, getEventChoiceDisabledReason, getEventChoiceDisabledReasonForChoice, getReforgeEligibleItem, buildEventResult } = events
  const { ALL_EQUIPMENT, formatEquipStats } = equipment
  const { ENEMIES, generateProceduralEnemy, generateProceduralBoss, getBestiaryId, getEnemyIcon, getEnemiesForLayer } = enemies
  const catalog = new Map()
  for (let i = 0; i < 100; i++) {
    const event = pickEvent(3, () => (i + 0.5) / 100)
    catalog.set(event.id, event)
  }
  assert.equal(catalog.size, 34, 'all thirty-four event definitions are reachable')
  const choice = (id, index) => catalog.get(id).choices[index]
  const getEq = id => ALL_EQUIPMENT.find(eq => eq.id === id.split(':')[0])

  // 数据结构：强制奇遇、三档、权重和 100、档名与 tone 合法、无预览 tooltip。
  for (const event of catalog.values()) {
    assert.equal(event.forced, true, `${event.id}: forced`)
    for (const [ci, c] of event.choices.entries()) {
      assert.equal(c.outcomes.length, 3, `${event.id}[${ci}]: three outcomes`)
      assert.equal(c.outcomes.reduce((sum, o) => sum + o.weight, 0), 100, `${event.id}[${ci}]: weights sum to 100`)
      for (const o of c.outcomes) {
        assert.ok(['good', 'mid', 'bad'].includes(o.tone), `${event.id}[${ci}]: tone`)
        assert.ok(o.label && typeof o.label === 'string', `${event.id}[${ci}]: themed label`)
        assert.ok(o.effect && typeof o.effect.type === 'string', `${event.id}[${ci}]: effect`)
        assert.equal(getEventChoiceDisabledReason(o.effect, rich()), null, `${event.id}[${ci}]: feasible when resourced`)
      }
      assert.equal(getEventChoiceDisabledReasonForChoice(c, rich()), null, `${event.id}[${ci}]: enabled when resourced`)
    }
  }
  for (const [stage, expectedCount] of [[1, 12], [2, 26], [3, 34], [4, 34]]) {
    const stageIds = new Set()
    for (let i = 0; i < 100; i++) {
      const event = pickEvent(stage, () => (i + 0.5) / 100)
      assert.ok(event.stageMin <= stage)
      stageIds.add(event.id)
    }
    assert.equal(stageIds.size, expectedCount, `stage ${stage}: exact available event count`)
  }

  // 分支精确性：受控 RNG 依次消耗分支抽签与档内抽签。
  {
    const chest = choice('treasure_chest', 0)
    const got = resolveEventOutcome(chest.outcomes, 3, sequence(0.3, 0.999999), rich())
    assert.deepEqual(got, { tone: 'good', label: '满载', effect: { type: 'gold', value: 30 } }, 'branch + inner roll resolve in order')
    assert.deepEqual(resolveEventOutcome(chest.outcomes, 3, sequence(0.55, 0), rich()), { tone: 'mid', label: '有点收获', effect: { type: 'gold', value: 8 } })
    assert.deepEqual(resolveEventOutcome(chest.outcomes, 3, sequence(0.999999, 0.999999), rich()), { tone: 'bad', label: '空箱', effect: { type: 'gold', value: 5 } })
  }
  {
    // 治愈之泉：清冽甘泉 / 水中带刺（诅咒档）/ 浑浊，边界精确。
    const drink = choice('healing_fountain', 0)
    assert.deepEqual(resolveEventOutcome(drink.outcomes, 3, sequence(0.69, 0.2), rich()), { tone: 'good', label: '清冽甘泉', effect: { type: 'heal', value: 30 } })
    assert.deepEqual(resolveEventOutcome(drink.outcomes, 3, sequence(0.7), rich()), { tone: 'bad', label: '水中带刺', effect: { type: 'heal_curse', heal: 30, curse_hp: 10 } })
    assert.deepEqual(resolveEventOutcome(drink.outcomes, 3, sequence(0.95), rich()), { tone: 'mid', label: '泉水浑浊', effect: { type: 'heal', value: 10 } })
    const sip = choice('healing_fountain', 1)
    assert.deepEqual(resolveEventOutcome(sip.outcomes, 3, sequence(0.999999), rich()), { tone: 'mid', label: '无甚感觉', effect: { type: 'none' } })
    const sell = choice('healing_fountain', 2)
    assert.deepEqual(resolveEventOutcome(sell.outcomes, 3, sequence(0.5, 0.5), rich()), { tone: 'mid', label: '正常价钱', effect: { type: 'gold', value: 12 } })
  }
  {
    const shrine = choice('dark_shrine', 0)
    assert.deepEqual(resolveEventOutcome(shrine.outcomes, 3, sequence(0.49), rich()), { tone: 'good', label: '神明回应', effect: { type: 'hp_reduce_pct', value: 20, atk_mult: 0.1, def_mult: 0 } })
    const shrine2 = choice('dark_shrine', 1)
    assert.deepEqual(resolveEventOutcome(shrine2.outcomes, 3, sequence(0.9), rich()), { tone: 'bad', label: '庇佑摇曳', effect: { type: 'maxhp_down_pct', value: 15, atk_mult: 0, def_mult: 0.06 } })
  }
  {
    // 看似平静的地面：拆除=金币或踩雷，冲刺=无事或损血（留 1）。
    const disarm = choice('spike_trap', 0)
    assert.deepEqual(resolveEventOutcome(disarm.outcomes, 3, sequence(0.1, 0), rich()), { tone: 'good', label: '完美拆除', effect: { type: 'gold', value: 18 } })
    assert.deepEqual(resolveEventOutcome(disarm.outcomes, 3, sequence(0.8), rich()), { tone: 'bad', label: '机关触发', effect: { type: 'hp_reduce', value: 12 } })
    const sprint = choice('spike_trap', 1)
    assert.deepEqual(resolveEventOutcome(sprint.outcomes, 3, sequence(0.54), rich()), { tone: 'good', label: '一跃而过', effect: { type: 'none' } })
    assert.deepEqual(resolveEventOutcome(sprint.outcomes, 3, sequence(0.9), rich()), { tone: 'bad', label: '重重摔倒', effect: { type: 'hp_reduce', value: 18 } })
    assert.equal(getEventChoiceDisabledReason({ type: 'hp_reduce', value: 12 }, broke()), null, 'trap harm never disables: hp clamps to 1')
  }
  {
    // 赌徒：0 金全档不可行 → 选项禁用并写明价格；付费档装备消耗 3 次抽签。
    const big = choice('gambler', 0)
    assert.match(getEventChoiceDisabledReasonForChoice(big, broke()), /金币不足：需要 20 金币/)
    let calls = 0
    assert.throws(() => resolveEventOutcome(big.outcomes, 3, () => { calls++; return 0 }, broke()), /事件结果全部不可行/, 'unaffordable tier never consumes RNG')
    assert.equal(calls, 0, 'preview draws nothing when infeasible')
    const won = resolveEventOutcome(big.outcomes, 3, sequence(0.1, 0, 0, 0), rich())
    assert.equal(won.tone, 'good'); assert.equal(won.label, '手气极佳')
    assert.equal(getEq(won.effect.eqId)?.rarity, 'rare'); assert.equal(won.effect.cost, 20)
    const lost = resolveEventOutcome(big.outcomes, 3, sequence(0.9), rich())
    assert.deepEqual(lost.effect, { type: 'gold', value: -20, paid: true }, 'loss charges the stake exactly once, marked as an active payment')
    const small = choice('gambler', 2)
    const smallWin = resolveEventOutcome(small.outcomes, 3, sequence(0.2, 0.999999, 0, 0), rich())
    assert.equal(smallWin.label, '稳稳命中'); assert.equal(smallWin.effect.cost, 5)
    const smallLoss = resolveEventOutcome(small.outcomes, 3, sequence(0.95), rich())
    assert.deepEqual(smallLoss.effect, { type: 'gold', value: -5, paid: true })
  }
  {
    // 不可行档剔除：全档不可行 → 整个选项禁用（抽取前抛错）；混合可行时免费档兜底。
    const buy = choice('alchemy_supply', 0)
    assert.match(getEventChoiceDisabledReasonForChoice(buy, broke()), /金币不足：需要 35 金币/, 'fully paid choice disables with a price reason')
    assert.throws(() => resolveEventOutcome(buy.outcomes, 3, sequence(0.999999), broke()), /事件结果全部不可行/)
    const prove = choice('greed_trial', 1)
    const onlyFree = resolveEventOutcome(prove.outcomes, 3, sequence(0), { ...broke(), hp: 1 })
    assert.equal(onlyFree.label, '血白流了', 'at 1 hp only the free harm tier remains feasible')
    const richRoll = resolveEventOutcome(choice('alchemy_supply', 0).outcomes, 3, sequence(0.4, 0), rich())
    assert.deepEqual(richRoll.effect, { type: 'card_trade', cardGrants: [], consumableGrants: [{ id: 'tactical_potion', count: 1 }], cost: 35, gold: 6, hpCost: 0, removesPurple: 0 }, 'good tier grants the potion plus bonus gold')
  }
  {
    // 净化师：0 金/无紫卡时只剩免费档。
    const cleanse = choice('cleansing_hermit', 0)
    const stuck = resolveEventOutcome(cleanse.outcomes, 3, sequence(0), broke())
    assert.equal(stuck.label, '仪式被打断', 'no gold and no purple: only the free tier resolves')
    const withPurple = resolveEventOutcome(cleanse.outcomes, 3, sequence(0.2, 0.9), { ...rich(), purpleLayers: 1 })
    assert.deepEqual(withPurple.effect, { type: 'card_trade', cardGrants: [], cost: 40, gold: 10, hpCost: 0, removesPurple: 1 }, 'good tier cleanses one layer and tips the hermit')
  }
  {
    // 陨落战士 / 卷轴 / 黑匣 / 商人：好中差三档数值连续。
    const fallen = choice('fallen_warrior', 0)
    assert.deepEqual(resolveEventOutcome(fallen.outcomes, 3, sequence(0.44, 0, 0, 0), rich()).effect.type, 'drop_equip')
    assert.deepEqual(resolveEventOutcome(fallen.outcomes, 3, sequence(0.9), rich()).effect, { type: 'none' }, 'loot tier can come up empty')
    const scroll = choice('ancient_scroll', 0)
    assert.deepEqual(resolveEventOutcome(scroll.outcomes, 3, sequence(0.1, 0.999999), rich()), { tone: 'good', label: '豁然贯通', effect: { type: 'xp', value: 60 } })
    const merchant = choice('dying_merchant', 1)
    const greedy = resolveEventOutcome(merchant.outcomes, 3, sequence(0.2, 0, 0.5), rich())
    assert.deepEqual(greedy.effect, { type: 'gold_xp', gold: 35, xp: 23 }, 'gold and xp ranges roll independently')
    assert.match(buildEventResult(greedy.effect), /获得 35 金币和 23 经验/)
  }
  {
    // 狂战祭坛：六种红卡契约，任一红卡都可通过其档位获得；无负面档视为安全选项。
    for (const cardId of ['red_berserk', 'red_blood', 'red_double', 'red_hunt', 'red_greed', 'blood_fury']) {
      const event = catalog.get('risk_shrine')
      const target = event.choices.find(c => c.outcomes.some(o => (o.effect.cardGrants ?? o.effect.grants ?? []).some(g => g.id === cardId)))
      assert.ok(target, `${cardId}: obtainable from risk_shrine`)
      const grant = target.outcomes.find(o => (o.effect.cardGrants ?? o.effect.grants ?? [])[0]?.id === cardId).effect
      assert.deepEqual(grant.cost, 0); assert.deepEqual(grant.hpCost, 0)
      assert.equal(getEventChoiceDisabledReasonForChoice(target, broke()), null, 'red contracts stay free in every tier')
    }
    // 诅咒藏书室：五组金卡+紫卡；深渊契约：三组金卡+黑卡，黑卡档位齐全。
    const archive = catalog.get('cursed_archive')
    for (const pair of [['gold_combo', 'curse_burn'], ['gold_lifesteal', 'curse_decay'], ['gold_merge_armor', 'curse_charge'], ['gold_crit', 'curse_heavy'], ['gold_saved_steps', 'curse_brittle']]) {
      const target = archive.choices.find(c => JSON.stringify(c.outcomes).includes(`"${pair[0]}"`) && JSON.stringify(c.outcomes).includes(`"${pair[1]}"`))
      assert.ok(target, `${pair.join('+')}: obtainable from cursed_archive`)
    }
    const abyss = catalog.get('abyss_contract')
    for (const pair of [['gold_merge_armor', 'doom_soul'], ['gold_lifesteal', 'doom_rebirth'], ['gold_combo_grace', 'doom_rage']]) {
      const target = abyss.choices.find(c => JSON.stringify(c.outcomes).includes(`"${pair[0]}"`))
      assert.ok(target, `${pair.join('+')}: obtainable from abyss_contract`)
      const badTier = target.outcomes.find(o => o.tone === 'bad')
      assert.ok((badTier.effect.cardGrants ?? badTier.effect.grants ?? []).some(g => cards.cardById(g.id)?.cardClass === 'black'), 'black card rides in every tier')
    }
  }

  // 锻造台：装备档位、重铸机器与同种子确定性。
  {
    const forge = choice('ancient_anvil', 0)
    assert.match(getEventChoiceDisabledReasonForChoice(forge, broke()), /金币不足：需要 25 金币/)
    const forged = resolveEventOutcome(forge.outcomes, 3, sequence(0.2, 0, 0, 0), rich())
    assert.equal(forged.label, '神兵出世'); assert.equal(getEq(forged.effect.eqId)?.rarity, 'epic'); assert.equal(forged.effect.cost, 25)
    assert.match(buildEventResult(forged.effect), /支付 25 金币/)
    const reforge = choice('ancient_anvil', 1)
    const first = reforge.outcomes[0]
    assert.equal(getReforgeEligibleItem(rich()), 'eq_tempest_pants_common:1:100', 'skip the worn helmet, take the first unworn common')
    const reborn = resolveEventOutcome(reforge.outcomes, 3, sequence(0.1, 0.5, 0.5, 0.5), rich())
    assert.equal(reborn.label, '精工重铸')
    assert.equal(getEq(reborn.effect.eqId)?.rarity, 'rare')
    assert.ok(reborn.effect.removeEqId === 'eq_tempest_pants_common:1:100')
    assert.deepEqual(Object.keys(reborn.effect).sort(), ['cost', 'eqId', 'gold', 'removeEqId', 'type'])
    assert.equal(resolveEventOutcome(reforge.outcomes, 3, sequence(0.9, 0, 0, 0, 0), rich()).effect.eqId.split(':')[0].startsWith('eq_'), true, 'failure tier still forges a common item')
    const sorted = { ...rich(), inventory: ['eq_fortress_gloves_common:2:110', 'eq_tempest_pants_common:1:100'] }
    assert.equal(getReforgeEligibleItem(sorted), 'eq_fortress_gloves_common:2:110', 'inventory order decides, not level')
    const a = resolveEventEffect(first.effect, 3, createRng(8291), rich())
    const b = resolveEventEffect(first.effect, 3, createRng(8291), rich())
    assert.deepEqual(a, b, 'same RNG seed includes equipment fluctuation and identity')
    assert.equal(buildEventResult(a), buildEventResult(b))
  }

  // 结果文本：各效果类型的人类可读描述；装备标签与共享格式器逐字一致。
  {
    assert.equal(buildEventResult({ type: 'none' }), '什么都没有发生。')
    assert.equal(buildEventResult({ type: 'gold', value: -12 }), '失去 12 金币。')
    assert.equal(buildEventResult({ type: 'heal', value: 30 }), '回复最大生命值（含装备）的 30%（不超过上限）。')
    assert.match(buildEventResult({ type: 'heal_curse', heal: 40, curse_hp: 10 }), /回复 40%.*降低 10%/)
    assert.match(buildEventResult({ type: 'hp_reduce_pct', value: 15, atk_mult: 0.06, def_mult: 0 }), /当前生命降低 15%.*攻击倍率 \+6 个百分点/)
    const cloudBoots = ALL_EQUIPMENT.find(eq => eq.id.includes('cloud'))
    const cloudId = `${cloudBoots.id}:5:100`
    const labels = formatEquipStats(cloudId)
    for (const effect of [{ type: 'drop_equip', eqId: cloudId, cost: 0 }, { type: 'reforge', removeEqId: cloudId, eqId: cloudId, gold: 15, cost: 0 }]) {
      const text = buildEventResult(effect)
      for (const label of labels) assert.ok(text.includes(label), `missing exact equipment label: ${label}`)
      assert.ok(text.includes(`（${labels.join('，')}）`), 'equipment stat block matches the shared formatter exactly')
    }
    const tradeText = buildEventResult({ type: 'card_trade', cardGrants: [{ id: 'atk_up_1', count: 1 }], cost: 10, gold: 5, hpCost: 3, removesPurple: 0 })
    assert.match(tradeText, /支付 10 金币/); assert.match(tradeText, /支付 3 点当前生命/); assert.match(tradeText, /攻击强化（白色·属性）×1/); assert.match(tradeText, /另获得 5 金币/)
  }

  // 非法效果在消耗 RNG 前抛错。
  for (const effect of [{ type: 'gold' }, { type: 'heal', value: 101 }, { type: 'heal_curse', heal: 5, curse_hp: 0 }, { type: 'unknown_kind', value: 1 }, { type: 'gamble', cost: 1, win_chance: 50 }]) {
    let calls = 0
    assert.throws(() => resolveEventEffect(effect, 3, () => { calls++; return 0 }, rich()), /事件|必须大于 0/, `invalid effect rejected: ${effect.type}`)
    assert.equal(calls, 0, 'no RNG on invalid effect')
  }

  generateProceduralEnemy(40, 10, false, createRng(72))
  generateProceduralBoss(40, createRng(72))
  route.generateRoute(createRng(72), 4)
  runEndlessSuite(enemies, cards, route)
}

function runEndlessSuite(enemies, cards, route) {
  const { ENEMIES, generateProceduralEnemy, generateProceduralBoss, getBestiaryId, getEnemyIcon, getEnemiesForLayer } = enemies
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
