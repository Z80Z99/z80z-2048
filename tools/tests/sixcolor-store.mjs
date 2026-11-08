import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const require = createRequire(import.meta.url)
  const { createPinia, setActivePinia } = require('pinia')
  const { useGameStore } = loadProject('./store/gameStore')
  const { cardById } = loadProject('./core/upgrade')
  const { initBattle } = loadProject('./core/battle')
  const { createRng } = loadProject('./core/random')
  const { createEmptyGrid } = loadProject('./core/board')
  const fresh = () => { setActivePinia(createPinia()); const store = useGameStore(); store.START_RUN(42); return store }
  const battle = store => {
    const node = store.route.find(node => node.accessible)
    store.SELECT_NODE(node.id)
  }
  {
    const store = fresh()
    for (const id of ['atk_up_1', 'def_up_1', 'max_hp_1', 'gold_1', 'bonus_turn_0_5', 'spawn_red_1', 'start_tile_1']) {
      assert.equal(store._grantUpgrade(cardById(id), 1000), true)
      assert.equal(store.upgrades.find(card => card.def.id === id).count, 1000)
    }
    assert.equal(store.player.attackMultiplier, 1)
    assert.equal(store.effectivePlayer.attackMultiplier, 81)
    assert.equal(store.effectivePlayer.maxHp, 8100)
    assert.equal(store.cardModifiers.spawnArmor, 200)
    battle(store)
    assert.equal(store.battle.maxTurns, 1006)
    assert.equal(store.battle.startingPointsGranted, 4000)
    assert.equal(store.battle.startingPointsPlaced + store.battle.startingPointsPending, 4000)
    store.battle = null
    store.screen = 'shop'
    store.player.gold = 100
    store.SHOP_REMOVE_UPGRADE('max_hp_1')
    assert.equal(store.effectivePlayer.maxHp, 8092)
    assert.equal(store.player.maxHp, 100)
    assert.ok(store.player.hp <= 8092)
  }
  {
    const store = fresh()
    store._grantUpgrade(cardById('red_berserk'), 3)
    assert.equal(store.cardModifiers.burstCoefficient, 3)
    assert.ok(Math.abs(store.cardModifiers.vulnerability - 0.9) < 1e-9)
    store.screen = 'shop'; store.player.gold = 100
    store.SHOP_REMOVE_UPGRADE('red_berserk')
    assert.equal(store.cardModifiers.burstCoefficient, 2)
    assert.equal(store.cardModifiers.vulnerability, 0.6)
    store._grantUpgrade(cardById('curse_burn'), 2)
    store._grantUpgrade(cardById('doom_soul'))
    store.shopRemoveUsed = false
    const before = store.player.gold
    store.SHOP_REMOVE_UPGRADE('curse_burn')
    store.SHOP_REMOVE_UPGRADE('doom_soul')
    assert.equal(store.player.gold, before)
    assert.equal(store._removeCardLayer('doom_soul', 'cleanse'), false)
    // 营地不再净化紫卡（REST_CLEANSE 已移除）；紫卡走净化药剂或奇遇。
    store.screen = 'rest'; store.restUsed = false
    assert.ok(!store.REST_CLEANSE, 'campfire no longer cleanses purple cards')
    assert.equal(store.upgrades.find(card => card.def.id === 'curse_burn').count, 2)
    // 事件净化：cleansing_hermit 的 card_trade removesPurple 生效，黑卡仍不可移除。
    store.gameEvent = {
      id: 'cleansing_hermit', title: '流浪的净化师', icon: '🕯️', desc: '', stageMin: 2,
      choices: [
        { label: '净化', effect: { type: 'card_trade', grants: [], cost: 0, gold: 0, hpCost: 0, removesPurple: 1 } },
        { label: '离开', effect: { type: 'none' } },
      ],
    }
    store.screen = 'event'; store.eventResult = null; store.eventBlackConfirmed = false
    store.RESOLVE_EVENT(0)
    assert.ok(store.eventResult, 'hermit cleanse resolves when a purple layer is held')
    store.APPLY_EVENT()
    assert.equal(store.upgrades.find(card => card.def.id === 'curse_burn').count, 1, 'one purple layer cleansed via event')
    assert.equal(store.upgrades.find(card => card.def.id === 'doom_soul').count, 1, 'black card untouched by cleanse')
    // 无紫卡时选项不可用，整体不应用。
    store._removeCardLayer('curse_burn', 'cleanse')
    store.gameEvent = { ...store.gameEvent, choices: [{ label: '净化', effect: { type: 'card_trade', grants: [], cost: 0, gold: 0, hpCost: 0, removesPurple: 1 } }, { label: '离开', effect: { type: 'none' } }] }
    store.screen = 'event'; store.eventResult = null
    assert.ok(store.eventChoiceDisabledReason(0), 'cleanse choice disabled without purple layers')
    store.RESOLVE_EVENT(0)
    assert.equal(store.eventResult, null, 'disabled choice cannot resolve')
  }
  {
    const store = fresh()
    store.player.hp = 40
    store.screen = 'rest'
    // 营地未休整也可以先离开，之后再进（选定下一层前可重入）。
    store.GO_TO_ROUTE()
    assert.equal(store.screen, 'route', 'unused campfire can be left for later')
    store.screen = 'rest'
    store.REST_HEAL()
    assert.equal(store.player.hp, 70)
    store.REST_HEAL()
    assert.equal(store.player.hp, 70)
    store.GO_TO_ROUTE()
    assert.equal(store.screen, 'route')
    store._grantUpgrade(cardById('heal_1'))
    assert.equal(store.player.hp, 82)
    assert.ok(!store.upgrades.some(card => card.def.id === 'heal_1'))
  }
  {
    // 商店与营地重入：离开再进不重建货架、不重置休整；选定下一层后旧节点锁定。
    const store = fresh()
    const shopNode = store.route.find(node => node.type === 'shop')
    store.route = store.route.map(item => item.id === shopNode.id ? { ...item, accessible: true } : item)
    store.SELECT_NODE(shopNode.id)
    assert.equal(store.screen, 'shop')
    const shelves = JSON.stringify([store.shopUpgrades, store.shopEquipment, store.shopConsumables, store.shopHeals])
    store.GO_TO_ROUTE()
    assert.equal(store.screen, 'route')
    const node = store.route.find(item => item.id === shopNode.id)
    assert.equal(node.completed, false, 'shop node stays re-enterable')
    assert.equal(node.accessible, true, 'shop node keeps its own access')
    store.SELECT_NODE(shopNode.id)
    assert.equal(store.screen, 'shop')
    assert.equal(JSON.stringify([store.shopUpgrades, store.shopEquipment, store.shopConsumables, store.shopHeals]), shelves, 're-entering the shop keeps the same shelves')
    // 选定下一层后，商店节点不可再进。
    const nextId = shopNode.nextIds[0]
    store.route = store.route.map(item => item.id === nextId ? { ...item, accessible: true } : item)
    store.screen = 'route'
    store.SELECT_NODE(nextId)
    assert.equal(store.route.find(item => item.id === shopNode.id).accessible, false, 'choosing the next floor collapses the old node')
    // 营地：休整一次后重入不重置 restUsed。
    const restNode = store.route.find(item => item.type === 'rest')
    store.route = store.route.map(item => item.id === restNode.id ? { ...item, accessible: true } : item)
    store.screen = 'route'
    store.SELECT_NODE(restNode.id)
    assert.equal(store.screen, 'rest')
    store.REST_HEAL()
    const hpAfterRest = store.player.hp
    store.GO_TO_ROUTE()
    store.SELECT_NODE(restNode.id)
    assert.equal(store.restUsed, true, 're-entering a used campfire keeps it used')
    store.REST_HEAL()
    assert.equal(store.player.hp, hpAfterRest, 'second heal attempt is a no-op')
  }
  {
    const store = fresh()
    store._addConsumable('tactical_potion', 2)
    assert.ok(store.consumableDisabledReason('tactical_potion'))
    store.USE_CONSUMABLE('tactical_potion')
    assert.equal(store.consumableCounts.tactical_potion, 2)
    battle(store)
    const oldTurns = store.battle.maxTurns
    store.USE_CONSUMABLE('tactical_potion')
    assert.equal(store.battle.maxTurns, oldTurns + 2)
    assert.equal(store.consumableCounts.tactical_potion, 1)
    store._addConsumable('combo_scroll')
    store.USE_CONSUMABLE('combo_scroll')
    assert.equal(store.battle.battleModifiers.comboBonus, 8)
    store.battle.phase = 'round_delay'
    store.USE_CONSUMABLE('tactical_potion')
    assert.equal(store.consumableCounts.tactical_potion, 1)
    store.battle.phase = 'round_end'
    store.NEXT_ROUND()
    assert.equal(store.battle.maxTurns, oldTurns)
    assert.equal(store.battle.roundModifiers.bonusTurns, undefined)
    assert.equal(store.battle.battleModifiers.comboBonus, 8)
    store._addConsumable('cleanse_potion')
    store._grantUpgrade(cardById('curse_burn'))
    store.USE_CONSUMABLE('cleanse_potion', 'curse_burn')
    assert.equal(store.consumableCounts.cleanse_potion, 1, 'cannot cleanse in battle')
    store.battle = null; store.screen = 'route'
    store._grantUpgrade(cardById('doom_soul'))
    store.USE_CONSUMABLE('cleanse_potion', 'doom_soul')
    assert.equal(store.consumableCounts.cleanse_potion, 1)
    store.USE_CONSUMABLE('cleanse_potion', 'curse_burn')
    assert.equal(store.consumableCounts.cleanse_potion, undefined)
    assert.ok(!store.upgrades.some(card => card.def.id === 'curse_burn'))
    store.START_RUN(43)
    assert.deepEqual(store.consumableCounts, {})
    assert.deepEqual(store.upgrades, [])
  }
  {
    const store = fresh()
    store.player.hp = 40
    const gear = store._addEquipment('eq_dragon_helmet_common:1:100')
    store.EQUIP_ITEM(gear)
    store._grantUpgrade(cardById('max_hp_1'))
    assert.equal(store.player.hp, 48, 'card heals its advertised amount, not extra gear-scaled HP')
  }
  {
    const store = fresh()
    store.screen = 'shop'; store.player.gold = 100
    store.shopConsumables = ['tactical_potion']
    store.BUY_SHOP_CONSUMABLE(0)
    assert.equal(store.player.gold, 65)
    assert.equal(store.consumableCounts.tactical_potion, 1)
    store.BUY_SHOP_CONSUMABLE(0)
    assert.equal(store.player.gold, 65)
    store.shopUpgrades = ['curse_burn']
    store.BUY_SHOP_UPGRADE(0)
    assert.ok(!store.upgrades.length, 'negative card cannot be purchased as normal reward')
  }
  {
    const store = fresh()
    store.screen = 'event'
    store.currentNodeId = 's1_event'
    store.gameEvent = { id: 'contract', title: '契约', icon: '', desc: '', choices: [{ label: '接受', effect: { type: 'card_trade', grants: [{ id: 'gold_merge_armor', count: 1 }, { id: 'doom_soul', count: 1 }], cost: 10, gold: 20, hpCost: 3 } }] }
    store.player.gold = 10
    store.RESOLVE_EVENT(0)
    assert.equal(store.eventResult.requiresBlackConfirmation, true)
    const preview = JSON.stringify(store.eventResult)
    store.APPLY_EVENT()
    assert.equal(store.player.gold, 10)
    assert.equal(store.upgrades.length, 0)
    store.CONFIRM_BLACK_EVENT()
    store.APPLY_EVENT()
    assert.equal(store.player.gold, 20)
    assert.equal(store.player.hp, 97)
    assert.equal(store.upgrades.length, 2)
    store.APPLY_EVENT()
    assert.equal(store.player.gold, 20)
    assert.ok(preview.includes('doom_soul'))
    assert.equal(store.eventBlackConfirmed, false)
  }
  {
    const store = fresh()
    store._gainXp(100)
    store._showNextReward()
    const token = store.rewardRollCount
    const id = store.rewardChoices.find(card => card.kind === 'persistent').id
    store.PICK_UPGRADE(id, token)
    const count = store.upgrades.find(card => card.def.id === id).count
    store.PICK_UPGRADE(id, token)
    store.SKIP_REWARD(token)
    assert.equal(store.upgrades.find(card => card.def.id === id).count, count)
    assert.equal(store.rewardQueue.length, 1)
  }
  // 巨量输入只做数值安全拒绝，不能在扣费或消耗路线节点后才失败。
  {
    const store = fresh()
    assert.equal(store._grantUpgrade(cardById('start_tile_1'), 2 ** 51), false)
    assert.equal(store.upgrades.length, 0)
    const node = store.route.find(node => node.accessible)
    store.upgrades = [{ def: cardById('start_tile_1'), count: 2 ** 51 }]
    store.SELECT_NODE(node.id)
    assert.equal(store.screen, 'route')
    assert.equal(store.route.find(item => item.id === node.id).completed, false)
    assert.equal(store.currentNodeId, null)
  }
  for (const mode of ['card', 'consumable']) {
    const store = fresh()
    const id = mode === 'card' ? 'atk_up_1' : 'tactical_potion'
    if (mode === 'card') store.upgrades = [{ def: cardById(id), count: Number.MAX_SAFE_INTEGER - 1 }]
    else store.consumableCounts[id] = Number.MAX_SAFE_INTEGER - 1
    store.screen = 'event'
    const grants = [{ id, count: 1 }, { id, count: 1 }]
    store.gameEvent = { id: 'overflow', title: '测试', icon: '', desc: '', choices: [{ label: '交换', effect: { type: 'card_trade', grants: mode === 'card' ? grants : [], consumableGrants: mode === 'consumable' ? grants : [], cost: 10, gold: 0, hpCost: 0 } }] }
    store.player.gold = 10
    store.RESOLVE_EVENT(0)
    store.APPLY_EVENT()
    assert.equal(store.player.gold, 10)
    assert.equal(mode === 'card' ? store.upgrades[0].count : store.consumableCounts[id], Number.MAX_SAFE_INTEGER - 1)
    assert.equal(store.screen, 'event')
  }

  {
    const store = fresh()
    store._grantUpgrade(cardById('doom_soul'))
    battle(store)
    store.player.hp = 1
    store.battle.grid = createEmptyGrid()
    store.battle.grid[0][1].value = 2
    store.battle.grid[0][2].value = 2
    store.SLIDE('left')
    assert.equal(store.player.hp, 0)
    assert.equal(store.battle.result.playerWon, false)
    assert.equal(store.battle.lastRoundResult.enemyActed, false)
    assert.equal(store.battle.lastRoundResult.curseDamage, 2)
  }
  {
    // 新机制 store 层：迟滞诅咒扣步数（保底 1）、贪婪之约金币翻倍、见多识广经验加成。
    const store = fresh()
    store._grantUpgrade(cardById('curse_heavy'), 2)
    battle(store)
    assert.equal(store.battle.maxTurns, Math.max(1, store.battle.baseTurns - 2), 'heavy legs reduces turns')
    store._grantUpgrade(cardById('curse_heavy'), 5)
    assert.equal(store.battle.maxTurns, 1, 'heavy legs never reduces turns below 1')

    const kill = store => {
      battle(store)
      store.battle.totalAttack = 100
      const result = {
        playerDamage: 0, enemyDamage: 100, enemyHpAfter: 0, overflowDamage: 0, playerFirst: true,
        playerSpeed: 9, enemySpeed: 1, playerHpAfter: store.player.hp, playerActed: true, enemyActed: false, avoidReason: null,
      }
      const goldBefore = store.player.gold
      const xpBefore = store.player.xp
      store._resolveKill(store.battle, result, store.player.hp)
      return { gold: store.player.gold - goldBefore, xp: store.player.xp - xpBefore }
    }
    const plain = fresh()
    const plainReward = kill(plain)
    const greedy = fresh()
    greedy._grantUpgrade(cardById('red_greed'))
    const greedyReward = kill(greedy)
    const tier = greedy.battle?.enemy?.tier ?? 1
    const baseGold = Math.floor(tier * 15)
    assert.equal(greedyReward.gold - plainReward.gold, baseGold, 'greed rating doubles only the base gold')
    const learned = fresh()
    learned._grantUpgrade(cardById('xp_1'))
    const learnedReward = kill(learned)
    assert.ok(learnedReward.xp > plainReward.xp, 'xp bonus raises kill experience')
  }
}
