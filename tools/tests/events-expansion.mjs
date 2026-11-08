// events25 扩展的独立字面量契约与真实 Pinia 动作回归；不写存档、不记录基线。
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const grants = (...ids) => ids.map(id => ({ id, count: 1 }))
const trade = (cards, { supplies, cost = 0, gold = 0, hpCost = 0, removesPurple = 0, black = false } = {}) => ({
  type: 'card_trade', grants: cards, cost, gold, hpCost, removesPurple,
  ...(supplies ? { consumableGrants: supplies } : {}), requiresBlackConfirmation: black,
})
const leave = () => ({ type: 'none' })

// 不从源 choices 派生期望：冻结十个新事件的顺序、阶段、全部36实质选项+10安全出口。
export const EXPANSION_CONTRACTS = new Map([
  ['abandoned_camp', { stageMin: 1, effects: [
    { type: 'heal', value: 20 },
    trade([], { supplies: grants('tactical_potion') }),
    { type: 'gold', value: { min: 8, max: 16 } }, leave(),
  ] }],
  ['lost_messenger', { stageMin: 1, effects: [
    trade(grants('xp_1'), { hpCost: 12, gold: { min: 15, max: 25 } }),
    trade(grants('xp_1'), { cost: 15 }),
    { type: 'drop_equip', rarity: 'common', cost: 30 }, leave(),
  ] }],
  ['training_room', { stageMin: 1, effects: [
    trade(grants('balanced_1'), { hpCost: 10 }),
    trade(grants('def_up_1'), { cost: 20 }),
    trade(grants('vigor_1'), { cost: 20 }), leave(),
  ] }],
  ['statue_purse', { stageMin: 1, effects: [
    { type: 'gold', value: { min: 8, max: 16 } },
    { type: 'disarm', gold_win: { min: 25, max: 40 }, hp_lose: 12 },
    { type: 'drop_equip', rarity: 'common', cost: 25 }, leave(),
  ] }],
  ['mirror_pool', { stageMin: 2, effects: [
    trade(grants('spawn_luck_1'), { cost: 30 }),
    trade(grants('halve_shield_1'), { cost: 30 }),
    trade(grants('atk_up_2'), { cost: 30 }),
    { type: 'heal', value: 15 }, leave(),
  ] }],
  ['abandoned_clock', { stageMin: 2, effects: [
    trade(grants('bonus_turn_0_5'), { cost: 35 }),
    trade(grants('charge_start_1', 'gold_saved_steps'), { cost: 65 }),
    trade(grants('gold_combo_grace'), { cost: 55 }),
    trade([], { supplies: grants('tactical_potion'), cost: 25 }), leave(),
  ] }],
  ['roaming_smith', { stageMin: 2, effects: [
    { type: 'reforge', cost: 0, sell_price: { min: 8, max: 15 }, new_rarity: 'rare' },
    { type: 'drop_equip', rarity: 'rare', cost: 60 },
    trade(grants('gold_merge_armor'), { cost: 60 }),
    trade(grants('def_up_1', 'vigor_1'), { cost: 25 }), leave(),
  ] }],
  ['cleansing_altar', { stageMin: 2, effects: [
    trade([], { hpCost: 15, removesPurple: 1 }),
    trade([], { cost: 35, removesPurple: 1 }),
    trade([], { supplies: grants('cleanse_potion'), cost: 45 }),
    trade([], { cost: 65, removesPurple: 2 }), leave(),
  ] }],
  ['astral_chess', { stageMin: 3, effects: [
    trade(grants('gold_execute', 'gold_crit'), { cost: 85 }),
    trade(grants('gold_execute', 'gold_crit', 'doom_rage'), { black: true }),
    trade(grants('gold_merge_armor', 'gold_carry'), { cost: 65 }),
    trade(grants('red_hunt')), leave(),
  ] }],
  ['crimson_garden', { stageMin: 3, effects: [
    trade([], { supplies: [{ id: 'berserk_potion', count: 2 }], hpCost: 18 }),
    trade([], { supplies: grants('tactical_potion', 'charge_potion'), cost: 60 }),
    trade([], { supplies: grants('combo_scroll'), cost: 45 }),
    { type: 'heal_curse', heal: 40, curse_hp: 10 }, leave(),
  ] }],
])

function catalogAt(pickEvent, stage) {
  const catalog = new Map()
  for (let index = 0; index < 1000; index++) {
    const event = pickEvent(stage, () => (index + 0.5) / 1000)
    assert.ok(event.stageMin <= stage, `${event.id}: locked event was selected at stage ${stage}`)
    catalog.set(event.id, event)
  }
  return catalog
}

function trackedRng(values, label) {
  let calls = 0
  return {
    rng: () => {
      assert.ok(calls < values.length, `${label}: unexpected RNG draw ${calls + 1}`)
      return values[calls++]
    },
    done: () => assert.equal(calls, values.length, `${label}: exact RNG consumption`),
    calls: () => calls,
  }
}

function rollsFor(effect, roll) {
  switch (effect.type) {
    case 'gold': return typeof effect.value === 'number' ? [] : [roll]
    case 'card_trade': return typeof effect.gold === 'number' ? [] : [roll]
    case 'drop_equip': return [roll, roll, roll]
    case 'reforge': return [roll, roll, roll, roll]
    case 'disarm': return [roll, roll]
    default: return []
  }
}

function scenarios(effect) {
  const values = [rollsFor(effect, 0), rollsFor(effect, 0.999999)]
  if (effect.type === 'disarm') {
    // 金币范围与成功率分别抽取；上端奖励、50%左邻和恰好50%都要覆盖。
    values.push([0.999999, 0.499999], [0, 0.5])
  }
  return values
}

function expectedResult(effect, stage, rolls, equipment, removeEqId) {
  let index = 0
  const next = () => rolls[index++]
  const number = value => typeof value === 'number' ? value : value.min + Math.floor(next() * (value.max - value.min + 1))
  const eqId = rarity => {
    const pool = equipment.ALL_EQUIPMENT.filter(eq => eq.rarity === rarity)
    const base = pool[Math.floor(next() * pool.length)].id
    const level = (stage - 1) * 2 + 1 + Math.floor(next() * 2)
    const fluct = 70 + Math.floor(next() * 61)
    return `${base}:${level}:${fluct}`
  }
  let result
  switch (effect.type) {
    case 'card_trade':
      result = {
        type: 'card_trade', cardGrants: effect.grants.map(grant => ({ ...grant })),
        cost: effect.cost, gold: number(effect.gold), hpCost: effect.hpCost,
        removesPurple: effect.removesPurple, requiresBlackConfirmation: effect.requiresBlackConfirmation,
        ...(effect.consumableGrants ? { consumableGrants: effect.consumableGrants.map(grant => ({ ...grant })) } : {}),
      }
      break
    case 'gold': result = { type: 'gold', value: number(effect.value) }; break
    case 'drop_equip': result = { type: 'drop_equip', eqId: eqId(effect.rarity), cost: effect.cost }; break
    case 'reforge': {
      const gold = number(effect.sell_price)
      result = { type: 'reforge', removeEqId, eqId: eqId(effect.new_rarity), gold, cost: effect.cost }
      break
    }
    case 'disarm': {
      const gold = number(effect.gold_win)
      result = next() < 0.5 ? { type: 'gold', value: gold } : { type: 'hp_reduce', value: effect.hp_lose }
      break
    }
    default: result = { ...effect }
  }
  assert.equal(index, rolls.length, 'independent expected contract uses each approved RNG draw')
  return result
}

const noRng = () => { throw new Error('cached or fixed event unexpectedly consumed RNG') }
const worn = 'eq_holy_helmet_common:1:100'
const spare = 'eq_tempest_pants_common:1:100'
const anotherSpare = 'eq_fortress_gloves_common:2:110'
const pureContext = () => ({ gold: 1000, hp: 70, inventory: [worn, spare, anotherSpare], equipment: { helmet: worn }, purpleLayers: 2 })

// 供旧两组测试调用：扩展交易不借用旧allowedClasses/零hpCost/gold假设。
export function assertExpansionContracts(catalog, loadProject) {
  const events = loadProject('./core/events')
  const equipment = loadProject('./core/equipment')
  const cards = loadProject('./core/upgrade')
  const supplies = loadProject('./core/consumables')
  assert.equal(EXPANSION_CONTRACTS.size, 10)
  assert.equal([...EXPANSION_CONTRACTS.values()].reduce((total, contract) => total + contract.effects.length, 0), 46)
  for (const [id, contract] of EXPANSION_CONTRACTS) {
    const event = catalog.get(id)
    assert.ok(event, `${id}: expansion event is reachable`)
    assert.equal(event.stageMin, contract.stageMin, `${id}: approved stageMin`)
    assert.deepEqual(event.choices.map(choice => choice.effect), contract.effects, `${id}: independent exact ordered option contracts`)
    assert.equal(event.choices.filter(choice => choice.effect.type === 'none').length, 1, `${id}: one safe exit`)
    const original = JSON.stringify(event)
    for (const [choiceIndex, effect] of contract.effects.entries()) {
      const choice = event.choices[choiceIndex]
      const label = `${id}[${choiceIndex}]`
      assert.ok(choice.label && choice.tooltip, `${label}: complete choice text`)
      assert.doesNotMatch(choice.tooltip, /undefined|NaN|永久|无法显示|数据不可用/)
      if (effect.type === 'none') assert.match(choice.tooltip, /无消耗.*无奖励/)
      for (const rolls of scenarios(effect)) {
        const context = pureContext()
        const before = JSON.stringify(context)
        const rng = trackedRng(rolls, label)
        assert.equal(events.getEventChoiceDisabledReason(choice.effect, context), null, label)
        const resolved = events.resolveEventEffect(choice.effect, contract.stageMin, rng.rng, context)
        rng.done()
        assert.deepEqual(resolved, expectedResult(effect, contract.stageMin, rolls, equipment, spare), `${label}: exact cached outcome including IDs, counts, costs and random endpoints`)
        assert.equal(events.getEventChoiceDisabledReason(resolved, context), null)
        assert.deepEqual(events.resolveEventEffect(resolved, contract.stageMin, noRng, context), resolved, `${label}: cache never rerolls`)
        assert.equal(JSON.stringify(context), before, `${label}: pure preview keeps all resources unchanged`)
        const text = events.buildEventResult(resolved)
        assert.doesNotMatch(text, /undefined|NaN|永久|无法显示|数据不可用/)
        if (effect.type !== 'card_trade') continue
        assert.equal(events.getEventRequiresBlackConfirmation(choice.effect), effect.requiresBlackConfirmation)
        assert.equal(events.getEventRequiresBlackConfirmation(resolved), effect.requiresBlackConfirmation)
        assert.equal(choice.tooltip, events.buildEventResult(effect), `${label}: raw tooltip matches independent full contract`)
        if (typeof effect.gold === 'number') assert.equal(choice.tooltip, text, `${label}: fixed preview matches cached text`)
        else {
          assert.match(choice.tooltip, /另获得 15~25 金币.*先支付消耗，再获得奖励/)
          assert.ok(text.includes(`另获得 ${resolved.gold} 金币`), 'random gold description uses cached value, not the source range')
        }
        assert.match(text, new RegExp(resolved.cost ? `支付 ${resolved.cost} 金币` : '不消耗金币'))
        assert.match(text, new RegExp(resolved.hpCost ? `支付 ${resolved.hpCost} 点当前生命` : '不消耗当前生命'))
        if (resolved.removesPurple) {
          assert.match(text, /净化一层已持有的紫卡/)
          if (resolved.removesPurple === 2) assert.match(text, /紫卡 ×2/)
        }
        for (const [field, lookup, validate] of [
          ['cardGrants', cards.cardById, cards.validateCard],
          ['consumableGrants', supplies.consumableById, supplies.validateConsumable],
        ]) {
          const raw = field === 'cardGrants' ? choice.effect.grants : choice.effect.consumableGrants
          if (!resolved[field]) continue
          assert.notEqual(resolved[field], raw, `${label}: grants array copied`)
          for (const [index, grant] of resolved[field].entries()) {
            assert.notEqual(grant, raw[index], `${label}: each grant copied`)
            const def = lookup(grant.id)
            assert.equal(def?.id, grant.id)
            assert.ok(validate(def), `${grant.id}: registered valid reward`)
            if (field === 'cardGrants') assert.equal(def.kind, 'persistent', 'event trade never introduces unsupported instant cards')
            assert.ok(text.includes(def.name) && text.includes(cards.cardClassText(def.cardClass)))
            assert.ok(text.includes(`×${grant.count}`), `${label}: description preserves count`)
            for (const item of def.effects) {
              assert.ok(text.includes(cards.cardEffectText(item)))
              assert.ok(text.includes(item.polarity === 'positive' ? '正面收益（+）' : '负面代价（−）'))
            }
            if (field === 'consumableGrants') assert.match(text, /存入消耗品库存，获得时不自动使用.*使用消耗 1 份/)
            if (def.cardClass === 'black') assert.match(text, /本局无法移除，商店与净化均无效.*额外确认.*确认前取消/)
          }
        }
      }
    }
    assert.equal(JSON.stringify(event), original, `${id}: no definition mutation`)
  }
}

function snapshot(store, omitPreview = false) {
  const state = { ...store.$state }
  if (omitPreview) { delete state.eventResult; delete state.eventBlackConfirmed }
  return JSON.stringify(state)
}

function cardCounts(store) {
  return Object.fromEntries(store.upgrades.map(card => [card.def.id, card.count]))
}

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const events = loadProject('./core/events')
  const equipment = loadProject('./core/equipment')
  const { cardById } = loadProject('./core/upgrade')
  const { useGameStore } = loadProject('./store/gameStore')
  const { createScopedRng } = loadProject('./core/random')
  const { createPinia, setActivePinia } = createRequire(import.meta.url)('pinia')
  const catalogs = new Map([1, 2, 3, 4, 40].map(stage => [stage, catalogAt(events.pickEvent, stage)]))
  for (const [stage, catalog] of catalogs) {
    assert.equal(catalog.size, stage === 1 ? 9 : stage === 2 ? 19 : 25, `S${stage}: exact catalog size`)
    for (const [id, contract] of EXPANSION_CONTRACTS) assert.equal(catalog.has(id), stage >= contract.stageMin, `${id}: stage gate ${stage}`)
  }
  const catalog = catalogs.get(3)
  assertExpansionContracts(catalog, loadProject)
  const effectAt = (id, index) => EXPANSION_CONTRACTS.get(id).effects[index]
  const fresh = (id, stage = EXPANSION_CONTRACTS.get(id).stageMin) => {
    setActivePinia(createPinia())
    const store = useGameStore()
    store.START_RUN(42)
    store.stage = stage
    store.screen = 'event'
    store.currentNodeId = `s${stage}_${id}`
    store.gameEvent = structuredClone(catalog.get(id))
    store.player.gold = 1000
    store.player.hp = 70
    store.player.inventory = [worn, spare, anotherSpare]
    store.player.equipment = { helmet: worn }
    // 黑卡放前面，断咒必须跳过黑卡；叠层紫卡用于验证只减指定层数。
    store.upgrades = [{ def: cardById('doom_soul'), count: 1 }, { def: cardById('curse_burn'), count: 2 }]
    return store
  }
  const installRng = (store, values, choiceIndex) => {
    const rng = trackedRng(values, `${store.gameEvent.id}[${choiceIndex}] store`)
    let factories = 0
    store._rng = (...scope) => {
      assert.deepEqual(scope, ['event-choice', choiceIndex], 'store uses the correct deterministic choice scope')
      assert.equal(++factories, 1, 'preview creates one scoped RNG only')
      return rng.rng
    }
    return rng
  }
  const blockRng = store => { store._rng = () => { throw new Error('blocked/cached event requested a new RNG') } }

  const originalRandom = Math.random
  const originalNow = Date.now
  try {
    Math.random = () => { throw new Error('unseeded event RNG') }
    Date.now = () => { throw new Error('wall clock event RNG') }

    // 不替换_rng的真实store重复同seed：覆盖生产作用域抽签与直接纯函数的一致性。
    for (const [id, index] of [['lost_messenger', 0], ['statue_purse', 1], ['roaming_smith', 0], ['lost_messenger', 2]]) {
      const first = fresh(id)
      const expected = events.resolveEventEffect(first.gameEvent.choices[index].effect, first.stage,
        createScopedRng(first.runSeed, first.stage, first.currentNodeId, 'event-choice', index), first.eventContext)
      first.RESOLVE_EVENT(index)
      assert.deepEqual(first.eventResult.effect, expected, `${id}: production scoped RNG matches explicit deterministic scope`)
      const second = fresh(id)
      second.RESOLVE_EVENT(index)
      assert.deepEqual(second.eventResult, first.eventResult, `${id}: same seed/node/choice has identical preview`)
      blockRng(first); blockRng(second)
      first.APPLY_EVENT(); second.APPLY_EVENT()
      assert.equal(snapshot(first), snapshot(second), `${id}: real seeded preview and cached application are deterministic`)
    }

    // 每个真实选项在解锁阶段与S3分别跑端点；50%分支还分别跑左邻与边界。
    for (const [id, contract] of EXPANSION_CONTRACTS) {
      for (const stage of new Set([contract.stageMin, 3])) {
        for (const [choiceIndex, effect] of contract.effects.entries()) {
          for (const rolls of scenarios(effect)) {
            const store = fresh(id, stage)
            const label = `${id}[${choiceIndex}] S${stage} ${JSON.stringify(rolls)}`
            const before = snapshot(store, true)
            const countsBefore = cardCounts(store)
            const suppliesBefore = { ...store.consumableCounts }
            const inventoryBefore = [...store.player.inventory]
            const gearBefore = { ...store.player.equipment }
            const playerBefore = { ...store.player }
            const maxHpBefore = store.effectivePlayer.maxHp
            const expected = expectedResult(effect, stage, rolls, equipment, spare)
            const rng = installRng(store, rolls, choiceIndex)
            assert.equal(store.eventChoiceDisabledReason(choiceIndex), null, label)
            store.RESOLVE_EVENT(choiceIndex)
            assert.ok(store.eventResult, `${label}: real RESOLVE_EVENT caches preview`)
            rng.done()
            assert.deepEqual(store.eventResult.effect, expected, `${label}: store exact cached contract`)
            assert.equal(store.eventResult.choiceIndex, choiceIndex)
            assert.equal(store.eventResult.desc, events.buildEventResult(expected))
            assert.equal(snapshot(store, true), before, `${label}: preview does not spend or grant any resource`)
            const preview = JSON.stringify(store.eventResult)
            blockRng(store)
            store.RESOLVE_EVENT(choiceIndex)
            store.RESOLVE_EVENT((choiceIndex + 1) % contract.effects.length)
            assert.equal(JSON.stringify(store.eventResult), preview, `${label}: cannot reroll or switch option after preview`)
            assert.equal(snapshot(store, true), before)
            if (expected.requiresBlackConfirmation) {
              assert.equal(store.eventBlackConfirmed, false)
              store.APPLY_EVENT()
              assert.equal(snapshot(store, true), before, `${label}: unconfirmed black choice cannot spend or grant`)
              assert.equal(JSON.stringify(store.eventResult), preview)
              store.CONFIRM_BLACK_EVENT()
              store.CONFIRM_BLACK_EVENT()
              assert.equal(store.eventBlackConfirmed, true)
              assert.equal(snapshot(store, true), before, 'black confirmation only authorizes; it does not apply rewards')
            }
            store.APPLY_EVENT()
            assert.equal(store.screen, 'route', `${label}: real APPLY_EVENT completes event`)
            assert.equal(store.gameEvent, null)
            assert.equal(store.eventResult, null)
            assert.equal(store.eventBlackConfirmed, false)
            const wantedCards = { ...countsBefore }
            const wantedSupplies = { ...suppliesBefore }
            const wantedInventory = [...inventoryBefore]
            let wantedGold = playerBefore.gold, wantedHp = playerBefore.hp, wantedBaseMax = playerBefore.maxHp
            switch (expected.type) {
              case 'gold': wantedGold += expected.value; break
              case 'heal': wantedHp = Math.min(maxHpBefore, wantedHp + Math.floor(maxHpBefore * expected.value / 100)); break
              case 'hp_reduce': wantedHp = Math.max(1, wantedHp - expected.value); break
              case 'heal_curse':
                wantedHp = Math.min(maxHpBefore, wantedHp + Math.floor(maxHpBefore * expected.heal / 100))
                wantedBaseMax -= Math.floor(wantedBaseMax * expected.curse_hp / 100)
                wantedHp = Math.min(wantedBaseMax + 12, wantedHp)
                break
              case 'drop_equip': wantedGold -= expected.cost; wantedInventory.push(expected.eqId); break
              case 'reforge':
                wantedGold += expected.gold - expected.cost
                wantedInventory.splice(wantedInventory.indexOf(expected.removeEqId), 1)
                wantedInventory.push(expected.eqId)
                break
              case 'card_trade':
                wantedGold += expected.gold - expected.cost
                wantedHp -= expected.hpCost
                for (const grant of expected.cardGrants) {
                  wantedCards[grant.id] = (wantedCards[grant.id] ?? 0) + grant.count
                  wantedHp += cardById(grant.id).effects.filter(item => item.type === 'maxHpBonus').reduce((total, item) => total + item.value * grant.count, 0)
                }
                for (const grant of expected.consumableGrants ?? []) wantedSupplies[grant.id] = (wantedSupplies[grant.id] ?? 0) + grant.count
                if (expected.removesPurple) {
                  wantedCards.curse_burn -= expected.removesPurple
                  if (!wantedCards.curse_burn) delete wantedCards.curse_burn
                }
                break
            }
            assert.equal(store.player.gold, wantedGold, `${label}: exactly one expense and reward`)
            assert.equal(store.player.hp, wantedHp, `${label}: exact HP expense/heal/clamp`)
            assert.equal(store.player.maxHp, wantedBaseMax, `${label}: base limit changes only for heal_curse`)
            assert.deepEqual(cardCounts(store), wantedCards, `${label}: exact persistent card grant/removal counts`)
            assert.deepEqual(store.consumableCounts, wantedSupplies, `${label}: exact consumables stored, never used`)
            assert.deepEqual(store.player.inventory, wantedInventory, `${label}: exact equipment replacement/reward identity`)
            assert.deepEqual(store.player.equipment, gearBefore, `${label}: reward never auto-equips or dismantles worn gear`)
            assert.deepEqual(store.player, {
              ...playerBefore, gold: wantedGold, hp: wantedHp, maxHp: wantedBaseMax,
              inventory: wantedInventory, equipment: gearBefore,
            }, `${label}: no hidden base stat or consumable activation side effects`)
            assert.equal(store.battle, null)
            assert.equal(store.player.xp, playerBefore.xp, 'xp_1 is a persistent combat bonus, not an instant XP reward')
            assert.equal(store.player.level, playerBefore.level)
            const applied = snapshot(store)
            store.APPLY_EVENT()
            store.RESOLVE_EVENT((choiceIndex + 1) % contract.effects.length)
            store.CONFIRM_BLACK_EVENT()
            assert.equal(snapshot(store), applied, `${label}: cannot apply twice or take a second option`)
          }
        }
      }
    }

    // 所有有成本的真实选项：纯函数先拒绝且不抽签，store预览/应用均不能付不足资源。
    for (const [id, contract] of EXPANSION_CONTRACTS) {
      for (const [index, effect] of contract.effects.entries()) {
        const failures = []
        if (effect.cost > 0) failures.push({ change: store => { store.player.gold = effect.cost - 1 }, reason: /金币不足/ })
        if (effect.hpCost > 0) failures.push({ change: store => { store.player.hp = effect.hpCost }, reason: /生命不足/ })
        if (effect.removesPurple > 0) failures.push({ change: store => { store.upgrades = [{ def: cardById('doom_soul'), count: 3 }] }, reason: /没有可净化|至少 2 层/ })
        if (effect.removesPurple === 2) failures.push({ change: store => { store.upgrades = [{ def: cardById('doom_soul'), count: 3 }, { def: cardById('curse_burn'), count: 1 }] }, reason: /至少 2 层/ })
        for (const { change, reason } of failures) {
          const blocked = fresh(id)
          change(blocked)
          blockRng(blocked)
          const before = snapshot(blocked)
          assert.match(events.getEventChoiceDisabledReason(blocked.gameEvent.choices[index].effect, blocked.eventContext), reason)
          assert.throws(() => events.resolveEventEffect(blocked.gameEvent.choices[index].effect, blocked.stage, noRng, blocked.eventContext), reason)
          assert.match(blocked.eventChoiceDisabledReason(index), reason)
          blocked.RESOLVE_EVENT(index)
          blocked.APPLY_EVENT()
          assert.equal(snapshot(blocked), before, `${id}[${index}]: disabled preview/action are complete no-ops`)
          const stale = fresh(id)
          const rng = installRng(stale, rollsFor(effect, 0), index)
          stale.RESOLVE_EVENT(index)
          rng.done()
          blockRng(stale)
          change(stale)
          const invalidated = snapshot(stale)
          assert.match(stale.eventChoiceDisabledReason(index), reason)
          stale.APPLY_EVENT()
          assert.equal(snapshot(stale), invalidated, `${id}[${index}]: changed resources invalidate preview without partial payment`)
        }
        // 恰好金币成本/生命成本+1可支付，生命不能以未来奖励抵押。
        if (effect.cost > 0 || effect.hpCost > 0) {
          const exact = fresh(id)
          exact.player.gold = effect.cost ?? 0
          if (effect.hpCost > 0) exact.player.hp = effect.hpCost + 1
          const rng = installRng(exact, rollsFor(effect, 0), index)
          exact.RESOLVE_EVENT(index)
          rng.done()
          assert.ok(exact.eventResult)
          blockRng(exact)
          exact.APPLY_EVENT()
          assert.equal(exact.screen, 'route', `${id}[${index}]: exact affordable boundary succeeds`)
          assert.equal(exact.player.gold, effect.type === 'card_trade' && typeof effect.gold !== 'number' ? effect.gold.min : effect.gold ?? 0)
          if (effect.hpCost > 0) assert.equal(exact.player.hp, 1)
        }
      }
    }

    // 重铸：无合格项、只有身上装备、旧存档同ID重复都拒绝；缓存目标不能悄悄换成另一件。
    const smithEffect = effectAt('roaming_smith', 0)
    for (const inventory of [[], [worn], [worn, worn], ['eq_holy_helmet_rare:1:100', 'unknown:1:100']]) {
      const store = fresh('roaming_smith')
      store.player.inventory = inventory
      blockRng(store)
      assert.equal(events.getReforgeEligibleItem(store.eventContext), null)
      assert.match(store.eventChoiceDisabledReason(0), /未装备普通装备/)
      assert.throws(() => events.resolveEventEffect(smithEffect, 2, noRng, store.eventContext), /未装备普通装备/)
      const before = snapshot(store)
      store.RESOLVE_EVENT(0); store.APPLY_EVENT()
      assert.equal(snapshot(store), before, 'unavailable reforge never alters gold, HP, inventory or equipped item')
    }
    for (const change of [
      store => { store.player.inventory = [anotherSpare, worn, spare] },
      store => { store.player.inventory = [worn, anotherSpare] },
      store => { store.player.equipment.pants = spare },
    ]) {
      const store = fresh('roaming_smith')
      const rng = installRng(store, rollsFor(smithEffect, 0), 0)
      store.RESOLVE_EVENT(0); rng.done()
      assert.equal(store.eventResult.effect.removeEqId, spare)
      const awarded = store.eventResult.effect.eqId
      blockRng(store)
      change(store)
      const canApply = store.player.inventory.includes(spare) && store.player.equipment.pants !== spare
      const before = snapshot(store)
      store.APPLY_EVENT()
      if (canApply) {
        assert.equal(store.screen, 'route')
        assert.deepEqual(store.player.inventory, [anotherSpare, worn, awarded], 'sorting preserves exact cached removal target')
        assert.equal(store.player.gold, 1008)
      } else {
        assert.match(store.eventChoiceDisabledReason(0), /未装备普通装备/)
        assert.equal(snapshot(store), before, 'removed/newly-equipped cached target rejects despite another eligible item')
      }
    }
    {
      const store = fresh('roaming_smith')
      store.player.inventory = [worn, worn, spare, anotherSpare]
      assert.equal(events.getReforgeEligibleItem(store.eventContext), spare, 'old equipped duplicate IDs are skipped, first truly unworn item chosen')
      const rng = installRng(store, rollsFor(smithEffect, 0), 0)
      store.RESOLVE_EVENT(0); rng.done(); blockRng(store); store.APPLY_EVENT()
      assert.equal(store.player.inventory.filter(id => id === worn).length, 2)
      assert.equal(store.player.equipment.helmet, worn)
      assert.ok(!store.player.inventory.includes(spare))
    }

    // 真实交易奖励溢出：每个grant都检查，第二份/后一个奖励失败也必须整体不扣不发。
    for (const [id, contract] of EXPANSION_CONTRACTS) {
      for (const [index, effect] of contract.effects.entries()) {
        if (effect.type !== 'card_trade') continue
        for (const [field, rewardList] of [['cards', effect.grants], ['supplies', effect.consumableGrants ?? []]]) {
          for (const grant of rewardList) {
            const store = fresh(id)
            const rng = installRng(store, rollsFor(effect, 0), index)
            store.RESOLVE_EVENT(index); rng.done(); blockRng(store)
            if (effect.requiresBlackConfirmation) store.CONFIRM_BLACK_EVENT()
            const count = Number.MAX_SAFE_INTEGER - grant.count + 1
            if (field === 'cards') {
              const existing = store.upgrades.find(card => card.def.id === grant.id)
              if (existing) existing.count = count
              else store.upgrades.push({ def: cardById(grant.id), count })
            } else store.consumableCounts[grant.id] = count
            const before = snapshot(store)
            store.APPLY_EVENT()
            assert.equal(snapshot(store), before, `${id}[${index}] ${grant.id}: overflow rejects the whole actual trade without HP/gold/payment/removal/other grants`)
          }
        }
      }
    }
    // 跨奖励域也做整体预检：消耗品失败时不能先发卡/净化，卡失败时不能先发道具。
    for (const failure of ['card-count', 'card-derived', 'supply-count']) {
      const store = fresh('cleansing_altar')
      const synthetic = trade(grants('def_up_1', 'start_tile_1'), { supplies: grants('tactical_potion', 'charge_potion'), cost: 10, hpCost: 3, gold: 20, removesPurple: 2 })
      store.gameEvent.choices[0].effect = synthetic
      const rng = installRng(store, [], 0)
      store.RESOLVE_EVENT(0); rng.done(); blockRng(store)
      if (failure === 'card-count') store.upgrades.push({ def: cardById('def_up_1'), count: Number.MAX_SAFE_INTEGER })
      if (failure === 'card-derived') store.upgrades.push({ def: cardById('start_tile_1'), count: 2 ** 51 - 1 })
      if (failure === 'supply-count') store.consumableCounts.charge_potion = Number.MAX_SAFE_INTEGER
      const before = snapshot(store)
      store.APPLY_EVENT()
      assert.equal(snapshot(store), before, `${failure}: all cards/supplies/gold/HP/cleansing preflight is atomic`)
    }

    // 双重断咒可跨两个紫卡条目，跳过所有黑/红/白卡；没有紫卡仍可买入净化药剂。
    {
      const store = fresh('cleansing_altar')
      store.upgrades = [
        { def: cardById('doom_rage'), count: 3 }, { def: cardById('red_blood'), count: 2 },
        { def: cardById('curse_burn'), count: 1 }, { def: cardById('doom_soul'), count: 1 },
        { def: cardById('curse_decay'), count: 2 }, { def: cardById('def_up_1'), count: 2 },
      ]
      const rng = installRng(store, [], 3)
      store.RESOLVE_EVENT(3); rng.done(); blockRng(store); store.APPLY_EVENT()
      assert.deepEqual(cardCounts(store), { doom_rage: 3, red_blood: 2, doom_soul: 1, curse_decay: 1, def_up_1: 2 })
      assert.equal(store.player.gold, 935)
      assert.equal(store.player.hp, 70)
    }
    {
      const store = fresh('cleansing_altar')
      store.upgrades = [{ def: cardById('doom_soul'), count: 2 }]
      const rng = installRng(store, [], 2)
      store.RESOLVE_EVENT(2); rng.done(); blockRng(store); store.APPLY_EVENT()
      assert.deepEqual(cardCounts(store), { doom_soul: 2 })
      assert.deepEqual(store.consumableCounts, { cleanse_potion: 1 }, 'buying cleanse potion does not use it or require existing purple cards')
      assert.equal(store.player.gold, 955, 'event-specific price is 45, not the regular shop price')
    }

    // 新黑卡棋局不能利用raw/cache/top-level的false逃过额外确认；取消即不获奖。
    for (const tamper of [false, true]) {
      const store = fresh('astral_chess')
      if (tamper) store.gameEvent.choices[1].effect.requiresBlackConfirmation = false
      const rng = installRng(store, [], 1)
      store.RESOLVE_EVENT(1); rng.done(); blockRng(store)
      assert.equal(store.eventResult.requiresBlackConfirmation, true)
      assert.equal(store.eventResult.effect.requiresBlackConfirmation, true)
      if (tamper) {
        store.eventResult.requiresBlackConfirmation = false
        store.eventResult.effect.requiresBlackConfirmation = false
      }
      const before = snapshot(store)
      store.APPLY_EVENT()
      assert.equal(snapshot(store), before, 'actual black reward ID prevents false-flag confirmation bypass')
      // 恢复展示标记后合法确认；false不能直接apply，授权后也只能一次。
      store.eventResult.requiresBlackConfirmation = true
      store.CONFIRM_BLACK_EVENT()
      store.APPLY_EVENT()
      assert.deepEqual(cardCounts(store), { doom_soul: 1, curse_burn: 2, gold_execute: 1, gold_crit: 1, doom_rage: 1 })
      const applied = snapshot(store)
      store.APPLY_EVENT(); store.CONFIRM_BLACK_EVENT()
      assert.equal(snapshot(store), applied)
    }
    {
      const store = fresh('astral_chess')
      const rng = installRng(store, [], 1)
      store.RESOLVE_EVENT(1); rng.done(); blockRng(store)
      store.CONFIRM_BLACK_EVENT()
      store.eventBlackConfirmed = false
      const before = snapshot(store)
      store.APPLY_EVENT()
      assert.equal(snapshot(store), before, 'withdrawn black confirmation leaves all resources and pending preview intact')
    }

    // 治疗减少 + 原含装备/白卡总上限先治疗 + 仅降基础上限 + 最后夹生命，顺序不可互换。
    for (const [baseMax, hp, expectedHp, expectedBase, expectedMax] of [
      [100, 40, 102, 90, 210], [100, 210, 210, 90, 210], [10, 1, 38, 10, 130],
    ]) {
      const store = fresh('crimson_garden')
      store.player.maxHp = baseMax
      store.player.hp = hp
      store.upgrades = [
        { def: cardById('max_hp_1'), count: 1 }, { def: cardById('curse_decay'), count: 2 },
        { def: cardById('doom_soul'), count: 1 },
      ]
      // 白卡+8，单件装备+112；总上限原为220/130，药汁40%再÷1.4取整。
      const hugeHelmet = 'eq_holy_helmet_common:69:102'
      store.player.inventory = [hugeHelmet]
      store.player.equipment = { helmet: hugeHelmet }
      assert.equal(equipment.getEquipStats(hugeHelmet).hp, 112)
      assert.equal(store.effectivePlayer.maxHp, baseMax + 120)
      const counts = cardCounts(store)
      const rng = installRng(store, [], 3)
      const originalHeal = store._heal
      const heals = []
      store._heal = amount => { heals.push([amount, store.player.maxHp, store.effectivePlayer.maxHp]); originalHeal(amount) }
      store.RESOLVE_EVENT(3); rng.done(); blockRng(store); store.APPLY_EVENT()
      assert.deepEqual(heals, [[Math.floor((baseMax + 120) * 0.4), baseMax, baseMax + 120]], 'heal consumes pre-curse total maxHP before base limit reduction')
      assert.equal(store.player.hp, expectedHp)
      assert.equal(store.player.maxHp, expectedBase, 'curse only reduces base maxHP with minimum10')
      assert.equal(store.effectivePlayer.maxHp, expectedMax)
      assert.deepEqual(cardCounts(store), counts, 'heal_curse does not grant/remove purple or black cards')
      assert.deepEqual(store.consumableCounts, {})
    }
    for (const [id, index, percentage] of [['abandoned_camp', 0, 20], ['mirror_pool', 3, 15]]) {
      const store = fresh(id)
      store.player.hp = 40
      store.upgrades.push({ def: cardById('curse_decay'), count: 2 })
      const hp = 40 + Math.floor(Math.floor(store.effectivePlayer.maxHp * percentage / 100) / 1.4)
      const rng = installRng(store, [], index)
      store.RESOLVE_EVENT(index); rng.done(); blockRng(store); store.APPLY_EVENT()
      assert.equal(store.player.hp, hp, `${id}: immediate healing respects persistent healing penalty`)
      assert.equal(store.player.maxHp, 100)
    }
  } finally {
    Math.random = originalRandom
    Date.now = originalNow
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run()
  console.log('PASS events-expansion.mjs')
}
