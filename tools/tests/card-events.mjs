// 六色风险事件的纯逻辑验证：校验获取渠道、交易预检、缓存拷贝与如实说明，不修改存档。
import assert from 'node:assert/strict'

const rich = () => ({ gold: 1000, hp: 1000, inventory: ['eq_tempest_pants_common:1:100'], equipment: { helmet: 'eq_holy_helmet_common:1:100' }, purpleLayers: 2 })
const noRng = () => { throw new Error('unexpected RNG') }

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const { pickEvent, resolveEventEffect, resolveEventOutcome, getEventChoiceDisabledReason, buildEventResult } = loadProject('./core/events')
  const { cardById, validateCard, cardClassText, cardEffectText, pickUpgrades } = loadProject('./core/upgrade')
  const { consumableById } = loadProject('./core/consumables')
  const catalog = stage => {
    const found = new Map()
    for (let i = 0; i < 1000; i++) {
      const event = pickEvent(stage, () => (i + 0.5) / 1000)
      assert.ok(event.stageMin <= stage)
      found.set(event.id, event)
    }
    return found
  }
  const stage1 = catalog(1)
  const stage2 = catalog(2)
  const all = catalog(3)
  assert.equal(stage1.size, 12)
  assert.equal(stage2.size, 26)
  assert.equal(all.size, 34)
  assert.ok(stage1.has('risk_shrine'))
  assert.ok(!stage1.has('cursed_archive') && !stage1.has('alchemy_supply') && !stage1.has('cleansing_hermit') && !stage2.has('abyss_contract'))
  assert.ok(stage2.has('cleansing_hermit'), 'purple cleansing becomes available from stage 2')

  // 获取渠道：六红、五紫、三黑各自能从对应事件的交易档位获得；黑卡三档都给。
  const obtainable = new Set()
  const channel = (eventId, cardClass, pairs) => {
    const event = all.get(eventId)
    const collected = new Set()
    for (const choice of event.choices) {
      for (const outcome of choice.outcomes) {
        const effect = outcome.effect
        if (effect.type !== 'card_trade') continue
        for (const grant of effect.grants ?? []) {
          const def = cardById(grant.id)
          assert.ok(validateCard(def), `${grant.id}: registered card`)
          if (def.cardClass === cardClass) collected.add(grant.id)
        }
      }
    }
    for (const id of pairs) assert.ok(collected.has(id), `${eventId}: ${id} obtainable`)
    if (['red', 'purple', 'black'].includes(cardClass)) for (const id of collected) obtainable.add(id)
    // 交易成本档内一致（血祭/断咒等免费契约三档都不收金币）。
    for (const choice of event.choices) {
      const costs = new Set(choice.outcomes.map(o => o.effect.type === 'card_trade' ? `${o.effect.cost}/${o.effect.hpCost}` : 'free'))
      if (costs.size > 1) assert.ok([...costs].some(c => c === 'free') || [...costs].every(c => c === [...costs][0]),
        `${eventId} 「${choice.label}」: trade costs stay consistent or the odd tier is the free fallback`)
    }
  }
  channel('risk_shrine', 'red', ['red_berserk', 'red_blood', 'red_double', 'red_hunt', 'red_greed', 'blood_fury', 'thorn_aegis'])
  channel('cursed_archive', 'purple', ['curse_burn', 'curse_decay', 'curse_charge', 'curse_heavy', 'curse_brittle'])
  channel('cursed_archive', 'gold', ['gold_combo', 'gold_lifesteal', 'gold_merge_armor', 'gold_crit', 'gold_saved_steps'])
  channel('abyss_contract', 'black', ['doom_soul', 'doom_rebirth', 'doom_rage'])
  for (const id of ['doom_soul', 'doom_rage']) {
    const other = [...all.get('astral_chess').choices.flatMap(c => c.outcomes), ...all.get('spirit_bargain').choices.flatMap(c => c.outcomes), ...all.get('doom_gate').choices.flatMap(c => c.outcomes)]
      .some(o => o.effect.type === 'card_trade' && (o.effect.grants ?? []).some(g => g.id === id))
    assert.ok(other, `${id}: also obtainable outside abyss_contract`)
  }
  assert.deepEqual([...obtainable].sort(), [
    'red_berserk', 'red_blood', 'red_double', 'red_hunt', 'red_greed', 'blood_fury', 'thorn_aegis',
    'curse_burn', 'curse_decay', 'curse_charge', 'curse_heavy', 'curse_brittle',
    'doom_soul', 'doom_rebirth', 'doom_rage',
  ].sort(), 'all seven red, five purple and three black cards are obtainable through reachable voluntary events')

  // 红卡/紫卡/黑卡的效果文本通过 buildEventResult 如实展示（档位结算后）。
  const sampleTexts = []
  for (const [eventId, index] of [['risk_shrine', 0], ['cursed_archive', 0], ['abyss_contract', 0]]) {
    const choice = all.get(eventId).choices[index]
    for (const outcome of choice.outcomes) {
      if (outcome.effect.type !== 'card_trade' || !(outcome.effect.grants ?? []).length) continue
      const result = resolveEventEffect(outcome.effect, all.get(eventId).stageMin, () => 0.5, rich())
      const text = buildEventResult(result)
      assert.doesNotMatch(text, /undefined|NaN|无法显示|数据不可用/)
      for (const grant of result.cardGrants) {
        const def = cardById(grant.id)
        assert.ok(text.includes(def.name) && text.includes(cardClassText(def.cardClass)))
        assert.ok(text.includes(`×${grant.count}`))
        assert.match(text, /本局持续生效，按持有数量累加/)
        if (def.cardClass === 'purple') assert.match(text, /普通商店不能移除，可用净化药剂或奇遇移除/)
        if (def.cardClass === 'black') assert.match(text, /本局无法移除，商店与净化均无效/)
        for (const effect of def.effects) {
          assert.ok(text.includes(cardEffectText(effect)))
          assert.ok(text.includes(effect.polarity === 'positive' ? '正面收益（+）' : '负面代价（−）'))
        }
      }
      sampleTexts.push(text)
    }
  }
  assert.ok(sampleTexts.length >= 3)
  const berserkText = buildEventResult(resolveEventEffect(all.get('risk_shrine').choices[0].outcomes.find(o => o.tone === 'mid').effect, 1, noRng, rich()))
  assert.match(berserkText, /爆发攻击系数 \+100%/)
  assert.match(berserkText, /承受的敌人攻击伤害系数 \+30%/)
  assert.match(berserkText, /可在商店付费移除/)
  const abyssMid = buildEventResult(resolveEventEffect(all.get('abyss_contract').choices[0].outcomes.find(o => o.tone === 'mid').effect, 3, noRng, rich()))
  assert.match(abyssMid, /本局无法移除，商店与净化均无效/)
  assert.doesNotMatch(abyssMid, /额外确认|确认后不可更改/, 'no confirmation copy: black cards settle directly')

  // 战术药剂交易：事件价、缓存拷贝、禁用原因。
  const potionChoice = all.get('alchemy_supply').choices[0]
  const potionGood = potionChoice.outcomes.find(o => o.tone === 'good').effect
  const potion = consumableById('tactical_potion')
  assert.equal(potionGood.cost, potion.price)
  const supplied = resolveEventEffect(potionGood, 2, () => 0, { gold: potion.price })
  assert.deepEqual(supplied.consumableGrants, [{ id: 'tactical_potion', count: 1 }])
  assert.notEqual(supplied.consumableGrants, potionGood.consumableGrants)
  assert.notEqual(supplied.consumableGrants[0], potionGood.consumableGrants[0])
  assert.match(buildEventResult(supplied), /支付 35 金币/)
  assert.match(buildEventResult(supplied), /本回合可行动步数 \+2/)
  assert.match(buildEventResult(supplied), /获得时不自动使用.*使用消耗 1 份.*仅当前回合生效，回合结束移除/)
  const badTier = potionChoice.outcomes.find(o => o.tone === 'bad').effect
  assert.match(getEventChoiceDisabledReason(badTier, { gold: potion.price - 1 }), /金币不足/)

  // 净化师事件：removesPurple 的校验、描述与缓存；营地不净化后这是药剂之外的途径之一。
  const hermit = all.get('cleansing_hermit')
  const hermitGood = hermit.choices[0].outcomes.find(o => o.tone === 'good').effect
  assert.equal(hermitGood.removesPurple, 1)
  assert.equal(hermitGood.cost, 40)
  assert.match(getEventChoiceDisabledReason(hermitGood, { gold: 1000 }), /没有可净化的紫色诅咒/)
  assert.match(getEventChoiceDisabledReason(hermitGood, { gold: 39, purpleLayers: 2 }), /金币不足/)
  assert.equal(getEventChoiceDisabledReason(hermitGood, { gold: 1000, purpleLayers: 2 }), null)
  const hermitResult = resolveEventEffect(hermitGood, 2, () => 0.999999, { gold: 1000, purpleLayers: 2 })
  assert.equal(hermitResult.removesPurple, 1)
  assert.match(buildEventResult(hermitResult), /支付 40 金币；不消耗当前生命；净化一层已持有的紫卡/)
  assert.equal(getEventChoiceDisabledReason({ type: 'card_trade', grants: [], cost: 0, gold: 0, hpCost: 0, removesPurple: -1 }, { gold: 1, purpleLayers: 1 }), '事件净化数量无效')
  assert.equal(getEventChoiceDisabledReason({ type: 'card_trade', grants: [], cost: 0, gold: 0, hpCost: 0, removesPurple: 1 }, { gold: 1000, purpleLayers: 0 }), '没有可净化的紫色诅咒')

  // 黑卡不再需要确认：来源 false 标记无意义，字段已从结算结果移除。
  const blackRaw = { type: 'card_trade', grants: [{ id: 'doom_soul', count: 1 }], cost: 0, gold: 0, hpCost: 0, removesPurple: 0, requiresBlackConfirmation: false }
  const blackResult = resolveEventEffect(blackRaw, 3, noRng, rich())
  assert.equal('requiresBlackConfirmation' in blackResult, false, 'confirmation field removed from resolved trades')
  const stacked = resolveEventEffect({ type: 'card_trade', grants: [{ id: 'red_berserk', count: 7 }, { id: 'curse_burn', count: 4 }], cost: 0, gold: 0, hpCost: 0, removesPurple: 0 }, 2, noRng, rich())
  assert.match(buildEventResult(stacked), /×7/)
  assert.match(buildEventResult(stacked), /×4/)
  assert.match(buildEventResult(stacked), /每张：/)

  const base = { type: 'card_trade', grants: [{ id: 'red_berserk', count: 1 }], cost: 0, gold: 0, hpCost: 0 }
  const invalid = [
    { ...base, grants: undefined }, { ...base, grants: null }, { ...base, grants: {} }, { ...base, grants: [] },
    ...['red_berserk:1', ' red_berserk', 'unknown', 'tactical_potion'].map(id => ({ ...base, grants: [{ id, count: 1 }] })),
    ...[0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(count => ({ ...base, grants: [{ id: 'red_berserk', count }] })),
    { ...base, grants: [{ id: 'red_berserk', count: 1 }, { id: 'missing', count: 1 }] },
    { ...base, grants: [{ id: 'red_berserk', count: Number.MAX_SAFE_INTEGER }, { id: 'red_berserk', count: 1 }] },
    { ...base, cardGrants: base.grants }, { ...base, cardGrants: null }, { ...blackResult, grants: null },
    { ...base, consumableGrants: null }, { ...base, consumableGrants: [{ id: 'atk_up_1', count: 1 }] },
    { ...base, consumableGrants: [{ id: 'tactical_potion', count: 0 }] },
    ...['cost', 'hpCost', 'gold'].flatMap(field => [-1, NaN, Infinity, '1', null].map(value => ({ ...base, [field]: value }))),
    { ...base, cost: { min: 0, max: 1 } }, { ...base, hpCost: { min: 0, max: 1 } },
    { ...base, gold: { min: -1, max: 1 } }, { ...base, gold: { min: 5, max: 1 } },
  ]
  for (const effect of invalid) {
    assert.equal(typeof getEventChoiceDisabledReason(effect, rich()), 'string', JSON.stringify(effect))
    let calls = 0
    assert.throws(() => resolveEventEffect(effect, 3, () => { calls++; return 0 }, rich()))
    assert.equal(calls, 0, 'entire grant list/cost validation fails before RNG')
  }
  // 有效 ID 的分类被污染也应拒绝；恢复共享定义，避免影响后续测试。
  const def = cardById('red_berserk')
  const oldClass = def.cardClass
  try {
    def.cardClass = 'gold'
    assert.match(getEventChoiceDisabledReason(base, rich()), /分类或效果无效/)
    assert.throws(() => resolveEventEffect(base, 1, noRng, rich()), /分类或效果无效/)
  } finally { def.cardClass = oldClass }

  const paid = { ...base, cost: 35, hpCost: 4, gold: { min: 40, max: 50 } }
  for (const context of [{ gold: 34, hp: 100 }, { gold: 35, hp: 4 }, { gold: 35 }, {}]) {
    let calls = 0
    assert.throws(() => resolveEventEffect(paid, 2, () => { calls++; return 0 }, context))
    assert.equal(calls, 0, 'cannot mortgage expected gold rewards or lethally spend HP')
  }
  let calls = 0
  const paidContext = { gold: 35, hp: 5 }
  const paidResult = resolveEventEffect(paid, 2, () => { calls++; return 0.999999 }, paidContext)
  assert.equal(calls, 1, 'only variable gold is rolled, once')
  assert.equal(paidResult.gold, 50)
  assert.deepEqual(resolveEventEffect(paidResult, 2, noRng, paidContext), paidResult)
  assert.match(buildEventResult(paidResult), /支付 35 金币.*支付 4 点当前生命.*另获得 50 金币.*先支付消耗，再获得奖励/)
  assert.deepEqual(paidContext, { gold: 35, hp: 5 })
  assert.throws(() => resolveEventEffect(base, 0, noRng, rich()), /正整数/)

  // 暗影祭坛的三档契约；锻造台重铸需要未装备普通装备。
  const shrine = all.get('dark_shrine')
  assert.deepEqual(resolveEventOutcome(shrine.choices[0].outcomes, 1, () => 0.1, rich()), { tone: 'good', label: '神明回应', effect: { type: 'hp_reduce_pct', value: 20, atk_mult: 0.1, def_mult: 0 } })
  assert.deepEqual(resolveEventOutcome(shrine.choices[1].outcomes, 1, () => 0.9, rich()), { tone: 'bad', label: '庇佑摇曳', effect: { type: 'maxhp_down_pct', value: 15, atk_mult: 0, def_mult: 0.06 } })
  assert.match(getEventChoiceDisabledReason(all.get('ancient_anvil').choices[1].outcomes[0].effect, { gold: 1000, inventory: [], equipment: {} }), /未装备普通装备/)
  assert.throws(() => resolveEventEffect(all.get('ancient_anvil').choices[1].outcomes[0].effect, 3, noRng, { gold: 1000, inventory: [], equipment: {} }), /未装备普通装备/)
  for (let i = 0; i < 100; i++) {
    const rewards = pickUpgrades(() => (i + 0.5) / 100, { count: 3 })
    assert.ok(rewards.every(def => ['white', 'blue', 'gold'].includes(def.cardClass)), 'normal rewards never grant risk/curse/doom cards')
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await run()
  console.log('PASS card-events.mjs')
}
