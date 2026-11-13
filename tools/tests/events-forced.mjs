// 强制事件专项：无安全出口、全三档零依赖防死锁、禁用原因与机器人选择策略单测。
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { FORCED_CONTRACTS } from './events-expansion.mjs'

const broke = () => ({ gold: 0, hp: 1, inventory: [], equipment: {}, purpleLayers: 0 })

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const events = loadProject('./core/events')
  const { useGameStore } = loadProject('./store/gameStore')
  const { pickEventChoice } = await import('../simulate.mjs')
  const { createPinia, setActivePinia } = createRequire(import.meta.url)('pinia')

  const catalog = new Map()
  for (let index = 0; index < 200; index++) {
    const event = events.pickEvent(3, () => (index + 0.5) / 200)
    catalog.set(event.id, event)
  }
  assert.equal(catalog.size, 34, 'all events reachable at S3')
  for (const event of catalog.values()) assert.equal(event.forced, true, `${event.id}: every event is a forced choice`)

  // 强制事件没有安全出口：不存在三档全是「无事发生」的选项。
  for (const event of catalog.values()) {
    assert.ok(event.choices.length >= 1, `${event.id}: has choices`)
    for (const choice of event.choices) {
      assert.ok(choice.outcomes.some(outcome => outcome.effect.type !== 'none'),
        `${event.id} 「${choice.label}」: every choice has at least one non-empty outcome`)
    }
  }

  // 防死锁：0 金、1 血、无装备无紫卡时，每事件至少一个选项的全部三档可行。
  for (const event of catalog.values()) {
    assert.ok(event.choices.some(choice => events.getEventChoiceDisabledReasonForChoice(choice, broke()) === null),
      `${event.id}: at least one choice is feasible across all three tiers under broke context`)
  }

  // 契约冻结：九个事件的阶段与选项名。
  for (const [id, contract] of FORCED_CONTRACTS) {
    const event = catalog.get(id)
    assert.ok(event, `${id}: forced event is reachable`)
    assert.equal(event.stageMin, contract.stageMin, `${id}: approved stageMin`)
    assert.deepEqual(event.choices.map(choice => choice.label), contract.choices.map(choice => choice.label), `${id}: approved choice labels`)
    for (const choice of event.choices) {
      assert.doesNotMatch(JSON.stringify(choice), /undefined|NaN/, `${id}: no broken values`)
    }
  }

  // 付费选项在 0 金时禁用，且禁用原因写明该选项最低档的金币要求；免费选项不受影响。
  for (const [id, index, required] of [
    ['screaming_well', 0, 10], ['cursed_bargain', 2, 12], ['spirit_bargain', 2, 22],
    ['midnight_auction', 0, 40], ['greed_trial', 0, 35], ['gambler', 0, 20],
  ]) {
    const effect = catalog.get(id).choices[index]
    const reason = events.getEventChoiceDisabledReasonForChoice(effect, broke())
    assert.ok(reason, `${id}[${index}]: unaffordable choice is disabled`)
    assert.match(reason, new RegExp(`${required}`), `${id}[${index}]: reason names the exact price`)
  }

  // starving_ambush / greed_trial 关键档位回归：文案性 label 已删除，效果直接来自契约。
  const starving = catalog.get('starving_ambush')
  assert.equal(starving.choices[0].label, '交出干粮')
  assert.deepEqual(starving.choices[0].outcomes.map(outcome => [outcome.weight, outcome.tone, outcome.effect.def_mult ?? 0]),
    [[45, 'good', 0.05], [40, 'mid', 0.04], [15, 'bad', 0.01]], '交出干粮 keeps its防御倍率 tiers')
  const greed = catalog.get('greed_trial')
  assert.equal(greed.choices[2].effect, undefined, 'choices carry outcomes, not a single effect')
  assert.deepEqual(greed.choices[2].outcomes.map(outcome => outcome.effect.value), [6, 10, 16], '转身离开 pays a real price in every tier')

  // heal_curse 的 curse_hp 必须为正：0% 诅咒是无意义伪档位。
  assert.match(
    events.getEventChoiceDisabledReason({ type: 'heal_curse', heal: 5, curse_hp: 0 }, broke()) ?? '',
    /诅咒数值必须大于 0/,
  )

  // 机器人选择：全禁用时返回 null。
  setActivePinia(createPinia())
  const store = useGameStore()
  store.START_RUN(42)
  store.screen = 'event'
  store.player.gold = 0
  store.player.hp = 1
  store.player.inventory = []
  store.player.equipment = {}
  store.upgrades = []
  store.gameEvent = {
    id: 'synthetic_deadlock', title: 'x', icon: '?', desc: 'x', forced: true, stageMin: 1,
    choices: [{
      label: 'a', outcomes: [
        { weight: 40, label: 'a1', tone: 'good', effect: { type: 'gold', value: -10 } },
        { weight: 30, label: 'a2', tone: 'mid', effect: { type: 'gold', value: -20 } },
        { weight: 30, label: 'a3', tone: 'bad', effect: { type: 'gold', value: -30 } },
      ],
    }],
  }
  assert.equal(pickEventChoice(store), null, 'all-disabled event yields no choice')
  assert.equal(store.eventChoiceDisabledReason(0), '金币不足：需要 10 金币')

  // 存在无负面档的选项时优先安全项，即使负面项期望更高。
  store.player.gold = 100
  store.gameEvent = {
    id: 'synthetic_safe', title: 'x', icon: '?', desc: 'x', forced: true, stageMin: 1,
    choices: [
      { label: '花钱', outcomes: [
        { weight: 40, label: 'p1', tone: 'bad', effect: { type: 'gold', value: -5 } },
        { weight: 30, label: 'p2', tone: 'mid', effect: { type: 'gold', value: -3 } },
        { weight: 30, label: 'p3', tone: 'bad', effect: { type: 'gold', value: -8 } },
      ] },
      { label: '治疗', outcomes: [
        { weight: 50, label: 'h1', tone: 'good', effect: { type: 'heal', value: 10 } },
        { weight: 30, label: 'h2', tone: 'mid', effect: { type: 'heal', value: 6 } },
        { weight: 20, label: 'h3', tone: 'bad', effect: { type: 'none' } },
      ] },
    ],
  }
  assert.deepEqual(pickEventChoice(store)?.label, '治疗', 'safe option wins over negative gold')
  assert.equal(store.eventChoiceDisabledReason(1), null)

  // 没有安全项时回退到期望最高的可执行项（强制事件不可跳过）。
  store.gameEvent = {
    id: 'synthetic_forced', title: 'x', icon: '?', desc: 'x', forced: true, stageMin: 1,
    choices: [
      { label: '花钱', outcomes: [
        { weight: 40, label: 'p1', tone: 'bad', effect: { type: 'gold', value: -5 } },
        { weight: 30, label: 'p2', tone: 'mid', effect: { type: 'gold', value: -3 } },
        { weight: 30, label: 'p3', tone: 'bad', effect: { type: 'gold', value: -8 } },
      ] },
      { label: '受伤', outcomes: [
        { weight: 50, label: 'd1', tone: 'bad', effect: { type: 'hp_reduce', value: 2 } },
        { weight: 30, label: 'd2', tone: 'bad', effect: { type: 'hp_reduce', value: 3 } },
        { weight: 20, label: 'd3', tone: 'bad', effect: { type: 'hp_reduce', value: 4 } },
      ] },
    ],
  }
  const forcedPick = pickEventChoice(store)
  assert.ok(forcedPick, 'forced event falls back to an enabled choice')
  assert.equal(forcedPick.label, '受伤', 'fallback scores tiers by weighted expectation')
  assert.equal(store.eventChoiceDisabledReason(forcedPick.index), null)
}
