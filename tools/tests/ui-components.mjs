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
}
