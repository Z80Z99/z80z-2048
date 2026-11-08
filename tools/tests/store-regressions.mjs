import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const require = createRequire(import.meta.url)
  const { createPinia, setActivePinia } = require('pinia')
  const { useGameStore } = loadProject('./store/gameStore')
  const { initBattle } = loadProject('./core/battle')
  const { createEmptyGrid } = loadProject('./core/board')
  const { createRng, createScopedRng } = loadProject('./core/random')
  const { getEquipStats } = loadProject('./core/equipment')
  const { UPGRADE_POOL } = loadProject('./core/upgrade')
  const { buildShop } = loadProject('./store/helpers')
  const fresh = (seed = 42) => {
    setActivePinia(createPinia())
    const store = useGameStore()
    store.START_RUN(seed)
    return store
  }
  const combat = (store, { type = 'battle', hp = 100, attack = 1, speed = 0, turns = 6 } = {}) => {
    const enemy = { id: 'rat', name: '测试敌人', hp, maxHp: hp, attack, defense: 0, speed, tier: 1 }
    store.currentNodeId = 's1_n99'
    store.route = [{ id: 's1_n99', type, layer: 1, position: 0, nextIds: [], enemy, accessible: false, completed: true }]
    store.screen = 'battle'
    store.battle = initBattle(enemy, turns, createRng(3))
  }

  // 装备派生属性不写回基础值，穿脱不能治疗，重复掉落不吞装备。
  {
    const store = fresh()
    const id = store._addEquipment('eq_holy_helmet_common:1:100')
    store.player.hp = 40
    store.EQUIP_ITEM(id)
    assert.equal(store.player.maxHp, 100)
    assert.equal(store.effectivePlayer.maxHp, 112)
    assert.equal(store.player.hp, 40)
    for (let i = 0; i < 3; i++) { store.UNEQUIP_ITEM('helmet'); store.EQUIP_ITEM(id) }
    assert.equal(store.player.hp, 40)
    store.EQUIP_ITEM('eq_king_armor_epic:1:100')
    assert.equal(store.player.equipment.armor, undefined)
    store.screen = 'shop'
    store.player.gold = 100
    store.shopEquipment = [id, null, null]
    store.BUY_SHOP_EQUIP(0)
    assert.equal(store.player.gold, 70)
    assert.equal(store.player.inventory.length, 2)
    assert.notEqual(store.player.inventory[0], store.player.inventory[1])
    assert.deepEqual(getEquipStats(store.player.inventory[0]), getEquipStats(store.player.inventory[1]))
    combat(store)
    store.UNEQUIP_ITEM('helmet')
    assert.equal(store.player.equipment.helmet, id)
  }

  // 事件结果只抽取一次；确认后不重复扣费/发奖，升级逐次发强化。
  {
    const store = fresh()
    store.screen = 'event'
    store.currentNodeId = 's1_n8'
    store.gameEvent = { id: 'test', title: '测试', icon: '', desc: '', choices: [{ label: '经验', effect: { type: 'xp', value: 100 } }] }
    store.RESOLVE_EVENT(0)
    const result = JSON.stringify(store.eventResult)
    store.RESOLVE_EVENT(0)
    assert.equal(JSON.stringify(store.eventResult), result)
    store.APPLY_EVENT()
    assert.equal(store.player.level, 3)
    assert.equal(store.screen, 'reward')
    assert.equal(store.rewardQueue.length, 2)
    store.APPLY_EVENT()
    assert.equal(store.player.level, 3)
    store.SKIP_REWARD()
    assert.equal(store.screen, 'reward')
    assert.equal(store.rewardQueue.length, 1)
    store.SKIP_REWARD()
    assert.equal(store.screen, 'route')
    assert.equal(store.pendingLevels, 0)
  }
  {
    const store = fresh()
    store.screen = 'event'
    store.currentNodeId = 's1_n8'
    store.gameEvent = { id: 'forge', title: '锻造', icon: '', desc: '', choices: [{ label: '淬火', effect: { type: 'drop_equip', rarity: 'epic', cost: 25 } }] }
    assert.ok(store.eventChoiceDisabledReason(0))
    store.RESOLVE_EVENT(0)
    assert.equal(store.eventResult, null)
    store.player.gold = 25
    store.RESOLVE_EVENT(0)
    const predicted = store.eventResult.effect.eqId
    store.APPLY_EVENT()
    assert.equal(store.player.gold, 0)
    assert.equal(store.player.inventory[0], predicted)
    store.APPLY_EVENT()
    assert.equal(store.player.inventory.length, 1)
  }

  // 较早回合或额外步数不再制造省步金币，最后用满步数击杀只领基础奖励。
  {
    const store = fresh()
    combat(store, { hp: 1000 })
    store.END_TURN_EARLY()
    assert.equal(store.battle.savedSteps, 6)
    store.SHOW_ROUND()
    store.NEXT_ROUND()
    store.battle.maxTurns = 1
    store.battle.enemyCurrentHp = 1
    store.battle.totalAttack = 100
    store.battle.grid = createEmptyGrid()
    store.battle.grid[0][1].value = 2
    store.SLIDE('left')
    assert.equal(store.battle.result.playerWon, true)
    assert.equal(store.battle.result.goldEarned, 15)
    assert.equal(store.battle.result.savedSteps, 0)
  }

  // 敌方先手致死后不能靠反击或击杀回血复活，结算不可重复领碎片。
  {
    const store = fresh()
    combat(store, { hp: 1, attack: 999, speed: 999 })
    store.player.hp = 1
    store.battle.totalAttack = 9999
    store.END_TURN_EARLY()
    assert.equal(store.battle.result.playerWon, false)
    assert.equal(store.player.hp, 0)
    assert.equal(store.battle.lastRoundResult.enemyDamage, 0)
    store.SHOW_BATTLE_RESULT()
    store.END_BATTLE()
    const gold = store.meta.totalGold
    store.END_BATTLE()
    store.GAME_OVER()
    assert.equal(store.meta.totalRuns, 1)
    assert.equal(store.meta.totalGold, gold)
    assert.equal(store.runOutcome, 'defeat')
    store.GO_TO_META_SHOP()
    assert.equal(store.screen, 'meta', 'settlement CTA can open permanent upgrades')
  }

  // 精英和 Boss 独立奖励不能被升级/溢出经验覆盖。
  for (const type of ['elite', 'boss']) {
    const store = fresh()
    combat(store, { type, hp: 1 })
    store.battle.totalAttack = 80
    store.END_TURN_EARLY()
    store.SHOW_BATTLE_RESULT()
    store.END_BATTLE('xp')
    assert.equal(store.screen, 'reward')
    assert.equal(store.rewardReason, type)
    assert.ok(store.rewardQueue.length >= 2)
    if (type === 'boss') assert.ok(store.rewardChoices.every(u => u.cardClass === 'gold'))
    for (let i = 0; store.screen === 'reward' && i < 20; i++) store.SKIP_REWARD()
    assert.equal(store.screen, type === 'boss' ? 'boss_choice' : 'route')
    assert.equal(store.rewardQueue.length, 0)
    if (type === 'boss') {
      store.BOSS_DEFEATED('end')
      store.BOSS_DEFEATED('end')
      assert.equal(store.meta.totalRuns, 1)
      assert.equal(store.runOutcome, 'victory')
    }
  }

  // 无限叠加、治疗、刷新和移除规则也由 store 校验。
  {
    const store = fresh()
    store.screen = 'shop'
    store.player.gold = 1000
    const def = UPGRADE_POOL.find(u => u.id === 'atk_up_1')
    assert.equal(store._grantUpgrade(def, 1000), true)
    store.shopUpgrades = [def.id, null, null]
    store.BUY_SHOP_UPGRADE(0)
    assert.equal(store.player.gold, 980)
    assert.equal(store.upgrades.find(u => u.def.id === def.id).count, 1001)
    assert.equal(store.player.attackMultiplier, 1, 'base stats never absorb card effects')
    store.shopHeals = ['heal_1']
    store.BUY_SHOP_HEAL(0)
    assert.equal(store.player.gold, 980)
    store.SHOP_REMOVE_UPGRADE(def.id)
    assert.equal(store.upgrades.find(u => u.def.id === def.id).count, 1000, 'remove only one stack')
    assert.equal(store.effectivePlayer.attackMultiplier, 81)
    assert.equal(store.shopRemoveUsed, true)
    store.REFRESH_SHOP()
    assert.equal(store.shopRemoveUsed, true)
    assert.equal(store.shopRefreshCount, 1)
    assert.equal(store.shopRefreshCost, 20)
    store._grantUpgrade(UPGRADE_POOL.find(u => u.id === 'spawn_red_1'), 1000)
    assert.equal(store.cardModifiers.spawnArmor, 200)
    store.shopRemoveUsed = false
    store.SHOP_REMOVE_UPGRADE('spawn_red_1')
    assert.ok(Math.abs(store.cardModifiers.spawnArmor - 199.8) < 1e-9)
  }

  // 不依赖时钟或全局 Math.random，所有正式动作按节点/回合/次数作用域抽签。
  {
    const originalRandom = Math.random
    const originalNow = Date.now
    const transcript = () => {
      const store = fresh(1234)
      const node = store.route.find(n => n.accessible)
      store.SELECT_NODE(node.id)
      store.battle.totalAttack = 999
      store.battle.enemyCurrentHp = 1
      store.END_TURN_EARLY()
      store.SHOW_BATTLE_RESULT()
      store.END_BATTLE('gold')
      while (store.screen === 'reward') store.SKIP_REWARD()
      store.screen = 'shop'
      store.player.gold = 500
      Object.assign(store, buildShop(createScopedRng(store.runSeed, 'test-shop'), 2))
      store.REFRESH_SHOP()
      return JSON.stringify({ player: store.player, shops: [store.shopUpgrades, store.shopEquipment, store.shopHeals], meta: store.meta })
    }
    try {
      Math.random = () => { throw new Error('Unseeded random in gameplay') }
      Date.now = () => { throw new Error('Clock in seeded gameplay') }
      assert.equal(transcript(), transcript())
    } finally {
      Math.random = originalRandom
      Date.now = originalNow
    }
    const samples = scope => { const rng = createScopedRng(42, ...scope); return [rng(), rng(), rng()] }
    assert.deepEqual(samples(['s1_n1', 1, 0]), samples(['s1_n1', 1, 0]))
    assert.notDeepEqual(samples(['s1_n1', 1, 0]), samples(['s1_n2', 1, 0]))
    assert.notDeepEqual(samples(['s1_n1', 1, 0]), samples(['s1_n1', 2, 0]))
  }

  // 生产/Node 中隐藏调试入口同时禁用 action。
  {
    const store = fresh()
    store.DEBUG_ADD_GOLD(10000)
    store.DEBUG_FORCE_LEVELUP()
    assert.equal(store.player.gold, 0)
    assert.equal(store.player.level, 1)
  }
}
