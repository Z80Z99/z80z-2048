// 六色风险事件的纯逻辑验证：只校验预检、固定奖励、缓存和如实说明，不修改存档。
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { EXPANSION_CONTRACTS, assertExpansionContracts } from './events-expansion.mjs'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const { pickEvent, resolveEventEffect, getEventChoiceDisabledReason, getEventRequiresBlackConfirmation, buildEventResult } = loadProject('./core/events')
  const { cardById, validateCard, cardClassText, cardEffectText, pickUpgrades } = loadProject('./core/upgrade')
  const { consumableById } = loadProject('./core/consumables')
  const rich = { gold: 1000, hp: 100, inventory: [], equipment: {} }
  const noRng = () => { throw new Error('unexpected RNG') }
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
  assert.equal(stage1.size, 9)
  assert.equal(stage2.size, 19)
  assert.equal(all.size, 25)
  assertExpansionContracts(all, loadProject)
  for (const [id, contract] of EXPANSION_CONTRACTS) {
    for (const [stage, found] of [[1, stage1], [2, stage2], [3, all]]) {
      assert.equal(found.has(id), stage >= contract.stageMin, `${id}: exact stage unlock`)
    }
  }
  assert.ok(stage1.has('risk_shrine'))
  assert.ok(!stage1.has('cursed_archive') && !stage1.has('alchemy_supply') && !stage1.has('cleansing_hermit') && !stage2.has('abyss_contract'))
  assert.ok(stage2.has('cleansing_hermit'), 'purple cleansing becomes available from stage 2')
  const grantList = (...ids) => ids.map(id => ({ id, count: 1 }))
  const expected = [
    ['risk_shrine', 1, [grantList('red_berserk'), grantList('red_blood'), grantList('red_double'), grantList('red_hunt'), grantList('red_greed')]],
    ['cursed_archive', 2, [
      grantList('gold_combo', 'curse_burn'),
      grantList('gold_lifesteal', 'curse_decay'),
      grantList('gold_merge_armor', 'gold_carry', 'curse_charge'),
      grantList('gold_crit', 'curse_heavy'),
      grantList('gold_saved_steps', 'curse_brittle'),
    ]],
    ['abyss_contract', 3, [grantList('gold_merge_armor', 'doom_soul'), grantList('gold_lifesteal', 'doom_rebirth'), grantList('gold_combo_grace', 'doom_rage')]],
    ['alchemy_supply', 2, [[]]],
  ]
  const obtainableRiskIds = new Set()
  const existingIcons = new Set([...all.values()].filter(event => !EXPANSION_CONTRACTS.has(event.id) && !expected.some(([id]) => id === event.id)).map(event => event.icon))
  for (const [id, stage, transactions] of expected) {
    const event = all.get(id)
    assert.equal(event.stageMin, stage)
    assert.ok(existingIcons.has(event.icon), 'new events reuse existing icon assets')
    assert.equal(event.choices.length, transactions.length + 1, 'each transaction remains voluntary with one safe leave option')
    const leaveChoices = event.choices.filter(option => option.effect.type === 'none')
    assert.equal(leaveChoices.length, 1)
    const leave = leaveChoices[0]
    assert.deepEqual(resolveEventEffect(leave.effect, stage, noRng, rich), { type: 'none' })
    assert.match(leave.tooltip, /无消耗.*无奖励/)
    const tradeChoices = event.choices.filter(option => option.effect.type === 'card_trade')
    assert.equal(tradeChoices.length, transactions.length)
    for (const [index, grants] of transactions.entries()) {
      const option = tradeChoices[index]
      const before = JSON.stringify({ option, rich })
      assert.deepEqual(option.effect.grants, grants)
      assert.equal(getEventChoiceDisabledReason(option.effect, rich), null)
      const result = resolveEventEffect(option.effect, stage, noRng, rich)
      assert.deepEqual(result.cardGrants, grants, `${id} transaction ${index}: cache preserves every exact explicit grant`)
      assert.equal(result.requiresBlackConfirmation, id === 'abyss_contract')
      assert.equal(getEventRequiresBlackConfirmation(option.effect), result.requiresBlackConfirmation)
      assert.equal(option.effect.requiresBlackConfirmation, result.requiresBlackConfirmation)
      assert.equal(result.hpCost, 0)
      assert.equal(result.gold, 0)
      assert.equal(result.cost, id === 'alchemy_supply' ? consumableById('tactical_potion').price : 0)
      assert.equal(getEventChoiceDisabledReason(result, rich), null)
      assert.deepEqual(resolveEventEffect(result, stage, noRng, rich), result, 'cached effect is idempotent without RNG')
      assert.notEqual(result.cardGrants, option.effect.grants)
      for (let i = 0; i < grants.length; i++) assert.notEqual(result.cardGrants[i], option.effect.grants[i])
      const text = buildEventResult(result)
      assert.equal(option.tooltip, text, 'tooltip states exactly the cached consequence, including cost and scope')
      assert.equal(buildEventResult(option.effect), text, 'fixed raw preview and cached description agree')
      assert.doesNotMatch(text, /undefined|NaN|无法显示|数据不可用|永久/)
      assert.match(text, /金币/)
      assert.match(text, /生命/)
      for (const grant of grants) {
        const def = cardById(grant.id)
        assert.ok(validateCard(def))
        assert.ok(text.includes(def.name) && text.includes(cardClassText(def.cardClass)))
        assert.ok(text.includes(`×${grant.count}`))
        assert.match(text, /本局持续生效，按持有数量累加/)
        if (['red', 'purple', 'black'].includes(def.cardClass)) obtainableRiskIds.add(grant.id)
        if (def.cardClass === 'purple') assert.match(text, /普通商店不能移除，可用净化药剂或奇遇移除/)
        if (def.cardClass === 'black') {
          assert.match(text, /本局无法移除，商店与净化均无效/)
          assert.match(text, /额外确认.*确认前取消/)
        }
        for (const effect of def.effects) {
          assert.ok(text.includes(cardEffectText(effect)))
          assert.ok(text.includes(effect.polarity === 'positive' ? '正面收益（+）' : '负面代价（−）'))
        }
      }
      assert.equal(JSON.stringify({ option, rich }), before, 'preview never mutates definition, inventory, gold or HP')
    }
  }
  assert.deepEqual([...obtainableRiskIds].sort(), [
    'red_berserk', 'red_blood', 'red_double', 'red_hunt', 'red_greed',
    'curse_burn', 'curse_decay', 'curse_charge', 'curse_heavy', 'curse_brittle',
    'doom_soul', 'doom_rebirth', 'doom_rage',
  ].sort(), 'all five red, five purple and three black cards are obtainable through reachable voluntary events')
  const redText = all.get('risk_shrine').choices[0].tooltip
  assert.match(redText, /爆发攻击系数 \+100%/)
  assert.match(redText, /承受的敌人攻击伤害系数 \+30%/)
  assert.match(redText, /可在商店付费移除/)
  assert.match(all.get('cursed_archive').choices[0].tooltip, /普通商店不能移除，可用净化药剂或奇遇移除/)
  assert.match(all.get('abyss_contract').choices[0].tooltip, /本局无法移除，商店与净化均无效/)
  assert.match(all.get('abyss_contract').choices[0].tooltip, /额外确认.*确认前取消/)

  const supply = all.get('alchemy_supply').choices[0].effect
  const potion = consumableById('tactical_potion')
  assert.equal(supply.cost, potion.price)
  const supplied = resolveEventEffect(supply, 2, noRng, { gold: potion.price })
  assert.deepEqual(supplied.consumableGrants, [{ id: 'tactical_potion', count: 1 }])
  assert.notEqual(supplied.consumableGrants, supply.consumableGrants)
  assert.notEqual(supplied.consumableGrants[0], supply.consumableGrants[0])
  assert.match(buildEventResult(supplied), /支付 35 金币/)
  assert.match(buildEventResult(supplied), /本回合可行动步数 \+2/)
  assert.match(buildEventResult(supplied), /获得时不自动使用.*使用消耗 1 份.*仅当前回合生效，回合结束移除/)
  assert.match(getEventChoiceDisabledReason(supply, { gold: potion.price - 1 }), /金币不足/)
  assert.match(getEventChoiceDisabledReason(supplied, {}), /金币不足/)

  // 净化师事件：removesPurple 的校验、描述与缓存；营地不再净化后这是药剂之外的唯一途径。
  const hermit = all.get('cleansing_hermit')
  const hermitCleanse = hermit.choices[0].effect
  assert.equal(hermitCleanse.removesPurple, 1)
  assert.equal(hermitCleanse.cost, 40)
  assert.match(getEventChoiceDisabledReason(hermitCleanse, { gold: 1000 }), /没有可净化的紫色诅咒/)
  assert.match(getEventChoiceDisabledReason(hermitCleanse, { gold: 39, purpleLayers: 2 }), /金币不足/)
  assert.equal(getEventChoiceDisabledReason(hermitCleanse, { gold: 1000, purpleLayers: 2 }), null)
  const hermitResult = resolveEventEffect(hermitCleanse, 2, noRng, { gold: 1000, purpleLayers: 2 })
  assert.equal(hermitResult.removesPurple, 1)
  assert.match(buildEventResult(hermitResult), /支付 40 金币；不消耗当前生命；净化一层已持有的紫卡。/)
  assert.equal(getEventChoiceDisabledReason({ type: 'card_trade', grants: [], cost: 0, gold: 0, hpCost: 0, removesPurple: -1 }, { gold: 1, purpleLayers: 1 }), '事件净化数量无效')
  assert.equal(getEventChoiceDisabledReason({ type: 'card_trade', grants: [], cost: 0, gold: 0, hpCost: 0, removesPurple: 1 }, { gold: 1000, purpleLayers: 0 }), '没有可净化的紫色诅咒')

  const base = { type: 'card_trade', grants: [{ id: 'red_berserk', count: 1 }], cost: 0, gold: 0, hpCost: 0 }
  const black = { ...base, grants: [{ id: 'doom_soul', count: 1 }], requiresBlackConfirmation: false }
  assert.equal(getEventRequiresBlackConfirmation(black), true)
  const blackResult = resolveEventEffect(black, 3, noRng, rich)
  assert.equal(blackResult.requiresBlackConfirmation, true, 'source false flag cannot bypass confirmation')
  const tamperedFlag = { ...blackResult, requiresBlackConfirmation: false }
  assert.equal(getEventRequiresBlackConfirmation(tamperedFlag), true)
  assert.equal(resolveEventEffect(tamperedFlag, 3, noRng, rich).requiresBlackConfirmation, true)
  assert.equal(getEventRequiresBlackConfirmation({ ...base, requiresBlackConfirmation: true }), false)
  assert.equal(getEventRequiresBlackConfirmation({ type: 'none' }), false)
  const stacked = resolveEventEffect({ ...base, grants: [{ id: 'red_berserk', count: 7 }, { id: 'curse_burn', count: 4 }] }, 2, noRng, rich)
  assert.match(buildEventResult(stacked), /×7/)
  assert.match(buildEventResult(stacked), /×4/)
  assert.match(buildEventResult(stacked), /每张：/)

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
    { ...blackResult, gold: { min: 1, max: 2 } }, { ...base, requiresBlackConfirmation: 'false' },
  ]
  for (const effect of invalid) {
    assert.equal(typeof getEventChoiceDisabledReason(effect, rich), 'string', JSON.stringify(effect))
    let calls = 0
    assert.throws(() => resolveEventEffect(effect, 3, () => { calls++; return 0 }, rich))
    assert.equal(calls, 0, 'entire grant list/cost validation fails before RNG')
  }
  // 有效 ID 的分类被污染也应拒绝；恢复共享定义，避免影响后续测试。
  const def = cardById('red_berserk')
  const oldClass = def.cardClass
  try {
    def.cardClass = 'gold'
    assert.match(getEventChoiceDisabledReason(base, rich), /分类或效果无效/)
    assert.throws(() => resolveEventEffect(base, 1, noRng, rich), /分类或效果无效/)
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
  assert.throws(() => resolveEventEffect(base, 0, noRng, rich), /正整数/)

  // 原祭坛的 HP/属性交易不转换为红卡，现有装备置换预检继续保留。
  const shrine = all.get('dark_shrine')
  assert.deepEqual(shrine.choices.map(option => option.effect), [
    { type: 'hp_reduce_pct', value: 20, atk_mult: 0.08 },
    { type: 'maxhp_down_pct', value: 15, def_mult: 0.12 }, { type: 'none' },
  ])
  assert.deepEqual(resolveEventEffect(shrine.choices[0].effect, 1, noRng), { type: 'hp_reduce_pct', value: 20, atk_mult: 0.08, def_mult: 0 })
  assert.deepEqual(resolveEventEffect(shrine.choices[1].effect, 1, noRng), { type: 'maxhp_down_pct', value: 15, atk_mult: 0, def_mult: 0.12 })
  assert.match(getEventChoiceDisabledReason(all.get('ancient_anvil').choices[1].effect, rich), /未装备普通装备/)
  assert.throws(() => resolveEventEffect(all.get('ancient_anvil').choices[1].effect, 3, noRng, rich), /未装备普通装备/)
  for (let i = 0; i < 100; i++) {
    const rewards = pickUpgrades(() => (i + 0.5) / 100, { count: 3 })
    assert.ok(rewards.every(def => ['white', 'blue', 'gold'].includes(def.cardClass)), 'normal rewards never grant risk/curse/doom cards')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run()
  console.log('PASS card-events.mjs')
}
