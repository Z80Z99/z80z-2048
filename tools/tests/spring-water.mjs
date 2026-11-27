// 泉水（治愈之泉 · 装瓶带走）：抽签边界、隐藏不泄露、先进先出、饮用（回血与持续回合状态）、按各自出价出售。
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const require = createRequire(import.meta.url)
  const { createPinia, setActivePinia } = require('pinia')
  const consumables = loadProject('./core/consumables')
  const { rollSpringWater, describeSpringWater, springWaterToTimedEffect, springWaterSellExpectation, SPRING_WATER_ID } = consumables
  const events = loadProject('./core/events')
  const { buildShop } = loadProject('./store/helpers')
  const { getCombinedCardModifiers } = loadProject('./core/battle')
  const { createRng } = loadProject('./core/random')
  const { useGameStore } = loadProject('./store/gameStore')
  // 受控随机数：多抽一次直接失败，用来锁住“每次结算恰好抽 2 次”。
  const sequence = (...values) => {
    let calls = 0
    return () => {
      assert.ok(calls < values.length, `unexpected draw ${calls + 1}`)
      return values[calls++]
    }
  }
  const roll = (quality, identity, value = 0) => rollSpringWater(quality, sequence(identity, value))

  // 身份边界：回血 45%、增益 27.5%、异常 27.5%，后两者各再均分三种状态。
  assert.deepEqual(roll(2, 0), { kind: 'heal', quality: 2, percent: 30, sellValue: 24 })
  assert.deepEqual(roll(2, 0.449999, 0.999999), { kind: 'heal', quality: 2, percent: 30, sellValue: 36 }, 'price range includes both ends')
  assert.deepEqual(roll(2, 0.45), { kind: 'buff', quality: 2, status: 'surge', rounds: 4, value: 16, sellValue: 24 })
  assert.equal(roll(2, 0.54).status, 'surge')
  assert.equal(roll(2, 0.55).status, 'vigor')
  assert.equal(roll(2, 0.7249).status, 'aegis')
  assert.equal(roll(2, 0.725).status, 'scald', 'the boundary itself is a curse')
  assert.equal(roll(2, 0.9).status, 'turbid')
  assert.equal(roll(2, 0.999999).status, 'silt')
  assert.equal(roll(2, 0.6).kind, 'buff')
  assert.equal(roll(2, 0.9).kind, 'curse')
  assert.throws(() => rollSpringWater(3, sequence(0, 0)), RangeError)
  assert.throws(() => rollSpringWater(-1, sequence(0, 0)), RangeError)

  // 品质决定强度、持续回合与售价区间：寡淡 / 寻常 / 佳酿。
  assert.deepEqual([0, 1, 2].map(quality => roll(quality, 0.725)), [
    { kind: 'curse', quality: 0, status: 'scald', rounds: 2, value: 2, sellValue: 4 },
    { kind: 'curse', quality: 1, status: 'scald', rounds: 3, value: 4, sellValue: 12 },
    { kind: 'curse', quality: 2, status: 'scald', rounds: 4, value: 6, sellValue: 24 },
  ])
  assert.deepEqual([0, 1, 2].map(quality => roll(quality, 0.45)), [
    { kind: 'buff', quality: 0, status: 'surge', rounds: 2, value: 6, sellValue: 4 },
    { kind: 'buff', quality: 1, status: 'surge', rounds: 3, value: 10, sellValue: 12 },
    { kind: 'buff', quality: 2, status: 'surge', rounds: 4, value: 16, sellValue: 24 },
  ])
  assert.deepEqual([0, 1, 2].map(quality => roll(quality, 0).percent), [8, 18, 30])
  assert.deepEqual([0, 1, 2].map(quality => springWaterSellExpectation(quality)), [6, 16, 30])

  // 揭示文案只在饮用后出现；不使用面向玩家禁用的措辞。
  const revealed = describeSpringWater(roll(2, 0.725))
  assert.equal(revealed, '灼泉：每回合结束灼烧，失去 6 点生命，持续 4 回合')
  assert.equal(describeSpringWater(roll(1, 0)), '回血之泉：回复生命上限的 18%')
  for (const identity of [0, 0.5, 0.6, 0.8, 0.95, 0.999]) assert.doesNotMatch(describeSpringWater(roll(2, identity)), /评级|系数|永久/)
  assert.match(describeSpringWater(roll(1, 0.999)), /减少23\.08%/, 'charge loss is shown as the real kept ratio')

  // 持续回合状态：写入战斗后并入修饰器，并在每个回合交界递减、归零移除。
  const surge = springWaterToTimedEffect(roll(2, 0.45))
  assert.deepEqual([surge.polarity, surge.rounds, surge.remaining, surge.modifiers], ['positive', 4, 4, { chargeStart: 16 }])
  assert.deepEqual(springWaterToTimedEffect(roll(0, 0.725)).modifiers, { burn: 2 })
  const battle = { cardModifiers: { chargeStart: 3 }, roundModifiers: {}, battleModifiers: {}, timedEffects: [surge] }
  assert.equal(getCombinedCardModifiers(battle).chargeStart, 19, 'timed effects stack with held cards and temporary modifiers')

  // 隐藏道具不进货架；抽签次数不随池的大小变化（仍是 2 个互不相同的道具位）。
  for (let seed = 1; seed <= 200; seed++) {
    const shop = buildShop(createRng(seed), 1 + (seed % 3), [])
    assert.equal(shop.shopConsumables.length, 2)
    assert.equal(new Set(shop.shopConsumables).size, 2)
    assert.ok(!shop.shopConsumables.includes(SPRING_WATER_ID), 'spring water never appears on the shelf')
  }
  assert.equal(consumables.consumableById(SPRING_WATER_ID).hidden, true)

  // 事件层：普通交易不能直接发放泉水；品质只接受 0/1/2；结果文案不泄露身份。
  assert.match(events.getEventChoiceDisabledReason({ type: 'card_trade', grants: [], consumableGrants: [{ id: SPRING_WATER_ID, count: 1 }], cost: 0, hpCost: 0, gold: 0, removesPurple: 0 }, {}), /不能直接发放隐藏道具/)
  assert.equal(events.getEventChoiceDisabledReason({ type: 'spring_water', quality: 3 }, {}), '泉水品质无效')
  assert.equal(events.getEventChoiceDisabledReason({ type: 'spring_water' }, {}), '事件数值无效：quality')
  assert.equal(events.getEventChoiceDisabledReason({ type: 'spring_water', quality: 1 }, { gold: 0, hp: 1 }), null, 'bottling is free even when broke')
  const resultText = events.buildEventResult({ type: 'spring_water', quality: 2 })
  assert.match(resultText, /泉水 ×1/)
  // 结果页可以说明“可能是什么”，但不能出现任何具体状态或品质名（它们只属于揭晓后的文案）。
  assert.doesNotMatch(resultText, /涌泉|泉劲|泉护|灼泉|浊泉|滞泉|佳酿|寻常|寡淡/)

  // ── store：事件入包 → 先进先出 → 饮用 → 出售 ──
  const fresh = () => { setActivePinia(createPinia()); const store = useGameStore(); store.START_RUN(42); return store }
  const fountain = events.getEventCatalog().find(event => event.id === 'healing_fountain')
  const openFountain = (store, draws) => {
    store.screen = 'event'
    store.gameEvent = fountain
    const original = store._rng
    store._rng = () => sequence(...draws)
    try { store.CHOOSE_EVENT(2) } finally { store._rng = original }
  }

  // 普通发放路径拒绝泉水，计数与队列保持同步。
  const blocked = fresh()
  assert.equal(blocked._addConsumable(SPRING_WATER_ID), false)
  assert.deepEqual([blocked.consumableCounts, blocked.springWaters], [{}, []])

  // 事件结算：恰好 3 次抽签（档位 1 次 + 档内 2 次），瓶子入包，结果页任何文字都看不出内容。
  const bottler = fresh()
  openFountain(bottler, [0.5, 0.1, 0.9])
  assert.equal(bottler.consumableCounts.spring_water, 1)
  assert.deepEqual(bottler.springWaters, [{ kind: 'heal', quality: 1, percent: 18, sellValue: 20 }])
  assert.deepEqual([bottler.eventResult.outcomeLabel, bottler.eventResult.tone], ['装瓶完成', 'mid'])
  assert.match(bottler.eventResult.desc, /泉水 ×1/)
  assert.doesNotMatch([bottler.eventResult.label, bottler.eventResult.outcomeLabel, bottler.eventResult.desc].join(' '), /涌泉|泉劲|泉护|灼泉|浊泉|滞泉|佳酿|寻常|寡淡|20 金币|18%/)
  // 界面不提供报价：泉水与普通道具同一出售流程，成交后才从金币变化看出价格。
  assert.equal(bottler.shopSellPrice(SPRING_WATER_ID), null, 'the shelf never quotes a price for spring water')
  assert.equal('springWaterOffer' in bottler, false, 'there is no appraisal getter any more')
  assert.equal(bottler.consumableDisabledReason(SPRING_WATER_ID)?.includes('回血'), false, 'the disabled reason never hints at the content')
  bottler.LEAVE_EVENT()
  assert.equal(bottler.screen, 'route')
  assert.match(bottler.consumableDisabledReason(SPRING_WATER_ID), /仅可在回合行动中使用/)
  assert.equal(bottler.USE_CONSUMABLE(SPRING_WATER_ID), undefined, 'cannot be drunk outside battle')
  assert.equal(bottler.consumableCounts.spring_water, 1)

  // 再装两瓶：队列先进先出，各自的隐藏内容互不影响。
  bottler._addSpringWater(roll(2, 0.45))
  bottler._addSpringWater(roll(0, 0.725))
  assert.equal(bottler.consumableCounts.spring_water, 3)
  assert.deepEqual(bottler.springWaters.map(water => water.sellValue), [20, 24, 4])

  const enterBattle = store => store.SELECT_NODE(store.route.find(node => node.accessible).id)
  enterBattle(bottler)
  assert.equal(bottler.battle.phase, 'playing')
  // 第一瓶（回血之泉 18%）：立即回复，受治疗衰减与上限约束。
  bottler.player.hp = 40
  const maxHp = bottler.effectivePlayer.maxHp
  assert.match(bottler.USE_CONSUMABLE(SPRING_WATER_ID), /^回血之泉：回复 \d+ 点生命$/)
  assert.equal(bottler.player.hp, Math.min(maxHp, 40 + Math.floor(maxHp * 18 / 100)))
  assert.equal(bottler.battle.timedEffects.length, 0, 'a healing bottle leaves no timed effect')
  // 第二瓶（涌泉 16，持续 4 回合）：并入修饰器，并进入下一回合的开局蓄力。
  assert.match(bottler.USE_CONSUMABLE(SPRING_WATER_ID), /^泉水揭晓：涌泉：每回合开局额外蓄力 16 点，持续 4 回合$/)
  assert.equal(bottler.activeCardModifiers.chargeStart, 16)
  assert.equal(bottler.battle.timedEffects[0].remaining, 4)
  const nextRound = () => { bottler.battle = { ...bottler.battle, phase: 'round_end' }; bottler.NEXT_ROUND() }
  nextRound()
  assert.equal(bottler.battle.totalAttack, 16, 'the timed bonus is part of the opening charge')
  assert.deepEqual(bottler.battle.timedEffects.map(effect => effect.remaining), [3])
  nextRound()
  assert.deepEqual(bottler.battle.timedEffects.map(effect => effect.remaining), [2])
  nextRound()
  assert.deepEqual(bottler.battle.timedEffects.map(effect => effect.remaining), [1])
  nextRound()
  // 持续 4 回合 = 饮用所在回合与其后 3 个回合；开局蓄力在回合交界处结算，
  // 所以第 2～5 回合各得到一次，正好 4 次，之后不再有。
  assert.equal(bottler.battle.timedEffects.length, 0, 'expired after four rounds counting the one it was drunk in')
  assert.equal(bottler.battle.totalAttack, 16, 'the fourth opening charge is granted where the effect expires')
  nextRound()
  assert.equal(bottler.battle.totalAttack, 0, 'no fifth grant')
  // 第三瓶（灼泉 2，持续 2 回合）：回合结束作为诅咒损血结算。
  bottler.player.hp = bottler.effectivePlayer.maxHp
  assert.match(bottler.USE_CONSUMABLE(SPRING_WATER_ID), /^泉水揭晓：灼泉：每回合结束灼烧，失去 2 点生命，持续 2 回合$/)
  bottler.END_TURN_EARLY()
  assert.equal(bottler.battle.lastRoundResult.curseDamage, 2, 'the burn is settled as curse damage at round end')
  assert.equal(bottler.player.hp < bottler.effectivePlayer.maxHp, true)
  assert.equal(bottler.consumableCounts.spring_water, undefined, 'every bottle was consumed')
  assert.deepEqual(bottler.springWaters, [])

  // 出售：按这一瓶自己的出价成交，先进先出；非商店屏不生效；所得不计入消费成长。
  const seller = fresh()
  seller._grantUpgrade(loadProject('./core/upgrade').cardById('spend_blade'))
  seller._addSpringWater(roll(2, 0, 0.999999))
  seller._addSpringWater(roll(1, 0))
  seller._addSpringWater(roll(0, 0))
  const attack = seller.player.attackMultiplier
  seller.SELL_CONSUMABLE(SPRING_WATER_ID)
  assert.equal(seller.player.gold, 0, 'selling only works inside the shop')
  seller.screen = 'shop'
  const proceeds = [0, 0, 0].map(() => {
    const before = seller.player.gold
    seller.SELL_CONSUMABLE(SPRING_WATER_ID)
    return seller.player.gold - before
  })
  assert.deepEqual(proceeds, [36, 12, 4], 'each bottle sells for its own hidden price, oldest first')
  assert.equal(seller.player.gold, 36 + 12 + 4)
  assert.equal(seller.consumableCounts.spring_water, undefined)
  const goldAfterSales = seller.player.gold
  seller.SELL_CONSUMABLE(SPRING_WATER_ID)
  assert.equal(seller.player.gold, goldAfterSales, 'nothing left to sell')
  assert.equal(seller.runStats.goldSpent, 0, 'selling never counts as spending')
  assert.equal(seller.player.attackMultiplier, attack, 'so it never feeds 挥金如土')

  // 新开局清空泉水。
  seller._addSpringWater(roll(2, 0))
  seller.START_RUN(7)
  assert.deepEqual([seller.consumableCounts, seller.springWaters], [{}, []])
}
