import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import Module from 'node:module'
import { pathToFileURL } from 'node:url'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const root = path.resolve(import.meta.dirname, '../..')
  const require = createRequire(import.meta.url)
  const ts = require('typescript'), vue = require('vue'), compiler = require('@vue/compiler-sfc')
  const { createPinia, setActivePinia } = require('pinia')
  const { useGameStore } = loadProject('./store/gameStore')
  const { cardById } = loadProject('./core/upgrade')
  const { pickEvent } = loadProject('./core/events')
  const eventOf = id => {
    for (let index = 0; index < 1000; index++) {
      const event = pickEvent(3, () => (index + 0.5) / 1000)
      if (event.id === id) return event
    }
    throw new Error(`Missing event: ${id}`)
  }
  // 受控随机数：多抽一次直接失败。
  const sequence = (...values) => {
    let calls = 0
    return () => {
      assert.ok(calls < values.length, `unexpected draw ${calls + 1}`)
      return values[calls++]
    }
  }
  function compile(relative) {
    const file = path.join(root, relative)
    const descriptor = compiler.parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor
    const code = compiler.compileScript(descriptor, { id: 'ui-integration', inlineTemplate: true }).content
    const module = new Module(file)
    module.filename = file; module.paths = Module._nodeModulePaths(path.dirname(file))
    module._compile(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file)
    module.loaded = true; Module._cache[file] = module
    return module.exports.default
  }
  compile('components/ExpandPanel.vue')
  compile('components/CardIcon.vue')
  compile('components/CardDetails.vue')
  compile('components/ItemIcon.vue')
  compile('components/Tile.vue')
  compile('components/Board.vue')
  compile('components/BattleItems.vue')
  compile('components/AttributeHelp.vue')
  compile('components/StatusBar.vue')
  compile('components/EnemyDisplay.vue')
  compile('components/ResultModal.vue')
  compile('components/UpgradesPanel.vue')
  const components = [compile('components/screens/BattleScreen.vue'), compile('components/screens/RewardScreen.vue'), compile('components/screens/ShopScreen.vue'), compile('components/UpgradesPanel.vue'), compile('components/EventPanel.vue')]
  const renderer = vue.createRenderer({
    createElement: tag => ({ tag, props: {}, children: [], parent: null }),
    createText: text => ({ text }), createComment: text => ({ comment: text }),
    setText: (node, text) => { node.text = text }, setElementText: (node, text) => { node.text = text },
    parentNode: node => node.parent, nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
    patchProp: (node, key, before, after) => { node.props[key] = after },
    insert(node, parent, anchor = null) { node.parent = parent; const old = parent.children.indexOf(node); if (old >= 0) parent.children.splice(old, 1); const index = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(index < 0 ? parent.children.length : index, 0, node) },
    remove(node) { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1) },
  })
  for (const Component of components) {
    const pinia = createPinia(); setActivePinia(pinia)
    const store = useGameStore(pinia); store.START_RUN(42)
    if (Component === components[0]) store.SELECT_NODE(store.route.find(node => node.accessible).id)
    else if (Component === components[1]) { store._gainXp(25); store._showNextReward() }
    else if (Component === components[2]) { store.shopUpgrades = ['gold_carry', null, null]; store.shopEquipment = [null, null, null]; store.shopConsumables = ['tactical_potion', null]; store.shopHeals = [null]; store.screen = 'shop' }
    else if (Component === components[3]) { store._grantUpgrade(cardById('gold_carry')); store._grantUpgrade(cardById('curse_burn')) }
    else {
      store.player.gold = 500
      store.gameEvent = eventOf('cleansing_altar')
      store.screen = 'event'
      store._grantUpgrade(cardById('curse_burn'), 2)
    }
    const scope = { children: [] }
    const errors = []
    const app = renderer.createApp(Component).use(pinia)
    app.config.errorHandler = error => errors.push(error)
    app.config.warnHandler = () => {}
    app.provide('motionReduced', vue.ref(true)).provide('gameInputBlocked', vue.ref(false)).provide('show-attribute-help', () => {})
    app.mount(scope)
    await vue.nextTick()
    if (Component === components[4]) {
      const descendants = node => [node, ...(node.children ?? []).flatMap(descendants)]
      const text = () => descendants(scope).map(node => node.text ?? '').join(' ')
      const choices = () => descendants(scope).filter(node => String(node.props?.class ?? '').split(' ').includes('event-choice'))
      assert.equal(choices().length, 5, 'five event choices render without being collapsed')
      // 选项卡只显示代价，不预告任何随机收获；代价行与文档生成器共用 summarizeChoiceCost。
      assert.match(text(), /支付65 金币/)
      assert.doesNotMatch(text(), /需持有.*紫卡/, 'mixed-tier purple prerequisite stays out of the cost line')
      assert.doesNotMatch(text(), /双咒俱碎|双重净化|只碎一层/)
      assert.doesNotMatch(text(), /必须选择一项|尚未生效|确认后结算|先支付，再获得/)
      store.CHOOSE_EVENT(3)
      await vue.nextTick()
      assert.equal(choices().length, 0, 'selection switches to the settled result page')
      assert.doesNotMatch(text(), /尚未生效/)
      assert.match(text(), /【/, 'result page leads with the themed outcome tier')
      const outcomeNode = descendants(scope).find(node => String(node.props?.class ?? '').split(' ').includes('event-outcome'))
      assert.ok(['event-tone-good', 'event-tone-mid', 'event-tone-bad'].some(tone => String(outcomeNode.props?.class ?? '').includes(tone)), 'outcome tier is tone-tinted')
      assert.match(text(), /支付 65 金币/)
      assert.match(text(), /净化一层已持有的紫卡 ×2/)
      assert.ok(store.upgrades.find(card => card.def.id === "curse_burn") === undefined || store.upgrades.find(card => card.def.id === "curse_burn").count === 0, "settled cleanse removed the purple layers")
      const leaveButton = descendants(scope).find(node => String(node.props?.class ?? '').split(' ').includes('event-continue'))
      assert.ok(leaveButton, 'leave button rendered')
      assert.notEqual(leaveButton.props.disabled, true, 'settled result can always be left')
      store.LEAVE_EVENT()
      await vue.nextTick()
      assert.equal(store.screen, 'route')
      store.screen = 'event'
      store.gameEvent = eventOf('crimson_garden')
      await vue.nextTick()
      assert.equal(choices().length, 4)
      assert.doesNotMatch(text(), /狂战药剂/, 'choice cards never preview granted supplies')
      assert.match(text(), /支付最多 18 点生命/, 'cost line caps the hp price when a bad tier only loses hp')
      assert.match(text(), /支付60 金币/, 'all-payment tiers show the flat price')
      store.gameEvent = eventOf('astral_chess')
      store.CHOOSE_EVENT(1)
      await vue.nextTick()
      assert.match(text(), /阴影低语 ×1/, 'settled grants render with full card details')
      assert.match(text(), /含黑卡 · 本局不可解除/, 'black marker replaces the confirmation block')
      assert.doesNotMatch(text(), /确认接受不可解除代价|黑卡代价/)
      assert.equal(store.upgrades.some(card => card.def.cardClass === 'black'), true, 'black card applies directly')
    }
    app.unmount()
    store.$dispose(); pinia._e.stop()
    assert.equal(errors.length, 0, errors.map(error => error.stack).join('\n'))
  }

  // 商店回收：出售区列出未穿戴的装备与持有的道具；普通物品点「出售」即成交，泉水先验货再决定。
  {
    const equipment = loadProject('./core/equipment')
    const consumables = loadProject('./core/consumables')
    const pinia = createPinia(); setActivePinia(pinia)
    const store = useGameStore(pinia); store.START_RUN(42)
    store.screen = 'shop'
    const sample = rarity => equipment.ALL_EQUIPMENT.find(item => item.rarity === rarity)
    // 史诗样本特意换一个名字，避免与普通样本同名（同一部位不同品质的装备名字相同）。
    const epicSample = equipment.ALL_EQUIPMENT.find(item => item.rarity === 'epic' && item.name !== sample('common').name)
    const common = store._addEquipment(equipment.makeEquipId(sample('common').id, 1, 100))
    const epic = store._addEquipment(equipment.makeEquipId(epicSample.id, 2, 100))
    store.EQUIP_ITEM(epic)
    store._addConsumable('combo_scroll', 2)
    store._addSpringWater(consumables.rollSpringWater(2, sequence(0.5, 0.5)))
    const realSetTimeout = global.setTimeout
    global.setTimeout = () => 0
    const scope = { children: [] }, errors = []
    const app = renderer.createApp(components[2]).use(pinia)
    app.config.errorHandler = error => errors.push(error)
    app.config.warnHandler = () => {}
    app.provide('motionReduced', vue.ref(true)).provide('gameInputBlocked', vue.ref(false)).provide('show-attribute-help', () => {})
    try {
      app.mount(scope)
      await vue.nextTick()
      const descendants = node => [node, ...(node.children ?? []).flatMap(descendants)]
      const nodes = () => descendants(scope)
      const hasClass = (node, name) => String(node.props?.class ?? '').split(' ').includes(name)
      const text = () => nodes().map(node => node.text ?? '').join(' ')
      const card = label => nodes().find(node => hasClass(node, 'shop-sellable') && node.props?.['aria-label'] === label)
      const click = label => {
        const node = nodes().find(node => node.text === label)
        assert.ok(node, `"${label}" is rendered`)
        const target = node.props?.onClick ? node : node.parent
        assert.equal(typeof target?.props?.onClick, 'function', `"${label}" is clickable`)
        target.props.onClick()
      }
      const sellButton = () => nodes().find(node => hasClass(node, 'shop-sell'))
      const noticeText = () => nodes().find(node => hasClass(node, 'shop-notice'))?.text ?? ''
      // 弹窗背后的出售区本来就有别的价格，涉及“是否泄露”的断言只看弹窗内的文字。
      const dialogText = () => {
        const dialog = nodes().find(node => hasClass(node, 'ui-dialog'))
        return dialog ? descendants(dialog).map(node => node.text ?? '').join(' ') : ''
      }

      // 出售区：未穿戴的装备与持有道具各一张卡；穿戴中的装备不出现；泉水显示“出价未知”。
      assert.match(text(), /出售/)
      assert.match(text(), /半价回收/)
      assert.ok(card(`查看${sample('common').name}的出售价格`), 'unworn equipment is listed')
      assert.ok(card('查看连锁卷轴的出售价格'), 'held consumables are listed')
      assert.ok(card('查看泉水的出售价格'), 'spring water is listed')
      assert.match(text(), /＋15 金币/)
      assert.match(text(), /连锁卷轴\s+×2/)
      assert.match(text(), /＋30 金币/)
      assert.equal(nodes().filter(node => hasClass(node, 'shop-sellable')).length, 3, 'exactly the three sellable items')
      assert.doesNotMatch(text(), new RegExp(epicSample.name), 'worn equipment is not sellable')

      // 普通道具：详情弹窗里的「出售」即成交。
      card('查看连锁卷轴的出售价格').props.onClick()
      await vue.nextTick()
      assert.ok(sellButton(), 'the sell dialog offers a sell button')
      assert.match(text(), /＋30 金币/)
      sellButton().props.onClick()
      await vue.nextTick()
      assert.deepEqual([store.player.gold, store.consumableCounts.combo_scroll], [30, 1])

      // 泉水：与普通道具同一出售流程——点「出售」直接成交，成交前不显示价格也不泄露内容。
      card('查看泉水的出售价格').props.onClick()
      await vue.nextTick()
      assert.match(dialogText(), /效果未知/)
      assert.match(dialogText(), /成交后才知道卖了多少钱/)
      assert.doesNotMatch(dialogText(), /请商人验货|商人出价|再想想/, 'there is no appraisal step any more')
      const springSell = sellButton()
      assert.ok(springSell, 'the spring water dialog offers the same sell button')
      assert.doesNotMatch(dialogText(), /30 金币|涌泉|泉劲|泉护|灼泉|浊泉|滞泉/, 'neither the price nor the content is shown before selling')
      springSell.props.onClick()
      await vue.nextTick()
      // 售价按这一瓶自己的隐藏值入账，成交后的提示才说出金额。
      assert.deepEqual([store.player.gold, store.consumableCounts.spring_water ?? 0, store.springWaters.length], [60, 0, 0])
      assert.match(noticeText(), /已出售，获得 30 金币/)
      assert.equal(errors.length, 0, errors.map(error => error.stack).join('\n'))
    } finally {
      global.setTimeout = realSetTimeout
      app.unmount()
      store.$dispose(); pinia._e.stop()
    }
  }

  // 「跳过每回合结算界面」只改界面节奏：偏好存本机；开启后直接进下一回合，回合记录可回看。
  {
    const prefs = loadProject('./utils/battlePrefs')
    for (const raw of [undefined, null, '', 'not json', '[]', '"x"', 'true', {}, { skipRoundEnd: 'yes' }, { skipRoundEnd: 1 }]) {
      assert.deepEqual(prefs.parseBattlePrefs(raw), { skipRoundEnd: false }, `only an explicit true enables skipping: ${JSON.stringify(raw)}`)
    }
    for (const raw of [{ skipRoundEnd: true }, '{"skipRoundEnd":true}', { skipRoundEnd: true, other: 1 }]) {
      assert.deepEqual(prefs.parseBattlePrefs(raw), { skipRoundEnd: true }, `explicit true enables skipping: ${JSON.stringify(raw)}`)
    }
    const stub = global.uni
    const writes = []
    global.uni = { getStorageSync: () => '', setStorageSync: (...args) => writes.push(args) }
    try {
      assert.deepEqual(prefs.loadBattlePrefs(), { skipRoundEnd: false }, 'empty storage loads the default')
      prefs.saveBattlePrefs({ skipRoundEnd: true })
      prefs.saveBattlePrefs({ skipRoundEnd: 'yes' })
      assert.deepEqual(writes, [['z80z_prefs', '{"skipRoundEnd":true}'], ['z80z_prefs', '{"skipRoundEnd":false}']], 'only the boolean is written')
      global.uni = { getStorageSync: () => { throw new Error('broken storage') }, setStorageSync: () => { throw new Error('quota') } }
      assert.deepEqual(prefs.loadBattlePrefs(), { skipRoundEnd: false }, 'a broken storage falls back to the default')
      const realError = console.error
      console.error = () => {}
      try { prefs.saveBattlePrefs({ skipRoundEnd: true }) } finally { console.error = realError }
    } finally {
      global.uni = stub
    }

    const realSetTimeout = global.setTimeout
    let timers = []
    global.setTimeout = fn => { timers.push(fn); return timers.length }
    const settleRound = async view => {
      timers = []
      view.store.END_TURN_EARLY()
      await vue.nextTick(); await vue.nextTick()
      assert.equal(view.store.battle.phase, 'round_delay', 'ending the turn starts the settlement delay')
      // 结算延迟与受伤提示各排一个定时器；一并触发相当于等过了 500ms。
      assert.ok(timers.length >= 1, 'the settlement delay schedules a timer')
      for (const fn of timers.splice(0)) fn()
      await vue.nextTick()
    }
    const mountBattle = async stored => {
      global.uni = { getStorageSync: () => stored, setStorageSync: () => {} }
      const pinia = createPinia(); setActivePinia(pinia)
      const store = useGameStore(pinia); store.START_RUN(42)
      store.SELECT_NODE(store.route.find(node => node.accessible).id)
      const scope = { children: [] }, errors = []
      const app = renderer.createApp(components[0]).use(pinia)
      app.config.errorHandler = error => errors.push(error)
      app.config.warnHandler = () => {}
      app.provide('motionReduced', vue.ref(true)).provide('gameInputBlocked', vue.ref(false)).provide('show-attribute-help', () => {})
      app.mount(scope)
      await vue.nextTick()
      const descendants = node => [node, ...(node.children ?? []).flatMap(descendants)]
      // 每次都重新遍历：回合记录是结算后才挂载的节点。
      const nodes = () => descendants(scope)
      const hasClass = (node, name) => String(node.props?.class ?? '').split(' ').includes(name)
      const text = () => nodes().map(node => node.text ?? '').join(' ')
      const button = label => nodes().find(node => hasClass(node, 'battle-tool-btn') && (node.text ?? '').startsWith(label))
      // 自定义渲染器把按钮文字直接写在按钮节点上；监听器在按钮自己身上。
      const clickText = label => {
        const node = nodes().find(node => node.text === label)
        assert.ok(node, `"${label}" is rendered`)
        assert.equal(typeof node.props?.onClick, 'function', `"${label}" is clickable`)
        node.props.onClick()
      }
      return { store, app, errors, text, button, clickText, hasOverlay: () => nodes().some(node => hasClass(node, 'round-card')) }
    }
    try {
      // 关闭（默认）：结算后停在回合记录，等玩家点「进入第 N 回合」；没有回看按钮。
      const plain = await mountBattle('')
      assert.match(plain.text(), /跳过回合结算：关/)
      assert.equal(plain.button('上回合记录'), undefined, 'no look-back button while skipping is off')
      await settleRound(plain)
      assert.equal(plain.store.battle.phase, 'round_end', 'skipping off: the round record stays up')
      assert.equal(plain.hasOverlay(), true)
      assert.match(plain.text(), /第 1 回合结束/)
      plain.store.NEXT_ROUND()
      await vue.nextTick()
      assert.equal(plain.store.battle.round, 2)
      assert.equal(plain.hasOverlay(), false, 'the record closes once the next round starts')
      plain.app.unmount(); plain.store.$dispose()

      // 开启：结算动效一结束就进下一回合；回合记录按钮可随时回看。
      const skipping = await mountBattle('{"skipRoundEnd":true}')
      assert.match(skipping.text(), /跳过回合结算：开/)
      await settleRound(skipping)
      assert.equal(skipping.store.battle.phase, 'playing', 'skipping on: the next round starts without waiting')
      assert.equal(skipping.store.battle.round, 2)
      assert.equal(skipping.hasOverlay(), false, 'no record overlay when skipping')
      assert.doesNotMatch(skipping.text(), /回合结束/)
      await vue.nextTick()
      const lookBack = skipping.button('上回合记录')
      assert.ok(lookBack, 'the previous round can be reviewed on demand')
      lookBack.props.onClick()
      await vue.nextTick()
      assert.equal(skipping.hasOverlay(), true)
      assert.match(skipping.text(), /第 1 回合结束/)
      assert.match(skipping.text(), /这是上一回合的记录/)
      assert.match(skipping.text(), /继续战斗/)
      skipping.clickText('继续战斗')
      await vue.nextTick()
      assert.equal(skipping.hasOverlay(), false, 'closing the record returns to the board')
      assert.equal(skipping.store.battle.phase, 'playing', 'reviewing the record never touches the battle')
      assert.equal(skipping.errors.length, 0, skipping.errors.map(error => error.stack).join('\n'))

      // 开关随时可关：关掉后回看按钮消失，偏好写回本机。
      const writes = []
      global.uni = { getStorageSync: () => '{"skipRoundEnd":true}', setStorageSync: (...args) => writes.push(args) }
      assert.ok(skipping.button('跳过回合结算'), 'the toggle is rendered')
      skipping.button('跳过回合结算').props.onClick()
      await vue.nextTick()
      assert.match(skipping.text(), /跳过回合结算：关/)
      assert.equal(skipping.button('上回合记录'), undefined, 'the look-back button hides once skipping is off')
      assert.deepEqual(writes, [['z80z_prefs', '{"skipRoundEnd":false}']], 'toggling persists the preference')
      skipping.app.unmount(); skipping.store.$dispose()
    } finally {
      global.setTimeout = realSetTimeout
      global.uni = stub
    }
  }
}
