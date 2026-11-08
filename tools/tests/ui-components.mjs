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
      assert.match(text(), /净化已持有紫卡2层/)
      assert.match(text(), /按持有列表顺序，先减首张紫卡/)
      assert.match(text(), /每次奇遇只选一项/)
      store.RESOLVE_EVENT(3)
      await vue.nextTick()
      assert.equal(choices().length, 0, 'selection switches to one cached confirmation result')
      assert.match(text(), /尚未生效 · 确认后结算/)
      assert.match(text(), /支付65金币/)
      assert.match(text(), /净化已持有紫卡2层/)
      assert.equal(store.upgrades.find(card => card.def.id === 'curse_burn').count, 2, 'preview leaves purple layers untouched')
      store.eventResult = null
      store.gameEvent = eventOf('crimson_garden')
      await vue.nextTick()
      assert.equal(choices().length, 5)
      assert.match(text(), /狂战药剂 ×2/)
      assert.match(text(), /存入背包，不会自动使用/)
      assert.match(text(), /受到的敌人攻击伤害增加30%/)
      store.gameEvent = eventOf('astral_chess')
      store.RESOLVE_EVENT(1)
      await vue.nextTick()
      assert.match(text(), /阴影低语 ×1/)
      assert.match(text(), /先确认接受，再另点「继续前进」才会生效/)
      const continueButton = descendants(scope).find(node => String(node.props?.class ?? '').split(' ').includes('event-continue'))
      assert.equal(continueButton.props.disabled, true, 'new black-card trade stays blocked before confirmation')
      assert.ok(!store.upgrades.some(card => card.def.cardClass === 'black'))
    }
    app.unmount()
    store.$dispose(); pinia._e.stop()
    assert.equal(errors.length, 0, errors.map(error => error.stack).join('\n'))
  }
}
