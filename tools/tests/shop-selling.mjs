// 商店回收：装备与道具按原价的一半出售，只在商店屏生效；穿戴中的装备要先卸下；出售所得不计入消费成长。
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const require = createRequire(import.meta.url)
  const { createPinia, setActivePinia } = require('pinia')
  const { useGameStore } = loadProject('./store/gameStore')
  const equipment = loadProject('./core/equipment')
  const { buildShop } = loadProject('./store/helpers')
  const { createRng } = loadProject('./core/random')
  const { cardById } = loadProject('./core/upgrade')
  const fresh = () => { setActivePinia(createPinia()); const store = useGameStore(); store.START_RUN(42); return store }
  const sample = rarity => equipment.ALL_EQUIPMENT.find(item => item.rarity === rarity)
  const instance = (rarity, level = 1) => equipment.makeEquipId(sample(rarity).id, level, 100)

  // 回收价：只看品质，是购买价的一半；等级与浮动不改变价格。
  assert.deepEqual(['common', 'rare', 'epic'].map(rarity => [equipment.equipCost(sample(rarity)), equipment.equipSellPrice(sample(rarity))]), [[30, 15], [70, 35], [120, 60]])
  assert.equal(equipment.equipSellPrice(undefined), 15)
  assert.equal(equipment.equipSellPrice({ rarity: 'unknown' }), 15)

  // 装备：出售后从背包移除；穿戴中的不能卖，卸下后才能卖；重复实例各算各的。
  const seller = fresh()
  seller.screen = 'shop'
  const common = seller._addEquipment(instance('common'))
  const rare = seller._addEquipment(instance('rare', 3))
  const epic = seller._addEquipment(instance('epic'))
  assert.equal(seller.player.gold, 0)
  seller.SELL_EQUIPMENT(common)
  assert.deepEqual([seller.player.gold, seller.player.inventory], [15, [rare, epic]])
  seller.EQUIP_ITEM(rare)
  seller.SELL_EQUIPMENT(rare)
  assert.deepEqual([seller.player.gold, seller.player.inventory.includes(rare), seller.player.equipment[sample('rare').slot]], [15, true, rare], 'worn equipment stays')
  seller.UNEQUIP_ITEM(sample('rare').slot)
  seller.SELL_EQUIPMENT(rare)
  assert.equal(seller.player.gold, 50, 'level and quality aside, rare equipment sells for 35')
  seller.SELL_EQUIPMENT(epic)
  assert.equal(seller.player.gold, 110)
  assert.deepEqual(seller.player.inventory, [])
  const beforeNoop = seller.player.gold
  seller.SELL_EQUIPMENT(epic)
  seller.SELL_EQUIPMENT('missing:1:100')
  seller.SELL_EQUIPMENT('')
  assert.equal(seller.player.gold, beforeNoop, 'unknown or already sold items change nothing')

  const copies = fresh()
  copies.screen = 'shop'
  const first = copies._addEquipment(instance('common'))
  const second = copies._addEquipment(instance('common'))
  assert.notEqual(first, second, 'duplicate drops keep separate instance ids')
  copies.SELL_EQUIPMENT(second)
  assert.deepEqual([copies.player.gold, copies.player.inventory], [15, [first]], 'selling one copy leaves the other')

  // 道具：原价的一半；卖完为止；净化药剂同样可卖。
  const supplies = fresh()
  supplies.screen = 'shop'
  assert.equal(supplies.shopSellPrice('combo_scroll'), null, 'nothing to quote while none are held')
  supplies._addConsumable('combo_scroll', 2)
  supplies._addConsumable('cleanse_potion')
  supplies._addConsumable('tactical_potion')
  assert.deepEqual(['combo_scroll', 'cleanse_potion', 'tactical_potion', 'berserk_potion'].map(id => supplies.shopSellPrice(id)), [30, 25, 17, null])
  for (const id of ['combo_scroll', 'combo_scroll', 'cleanse_potion', 'tactical_potion']) supplies.SELL_CONSUMABLE(id)
  assert.deepEqual([supplies.player.gold, supplies.consumableCounts], [30 + 30 + 25 + 17, {}])
  const afterEmpty = supplies.player.gold
  supplies.SELL_CONSUMABLE('combo_scroll')
  supplies.SELL_CONSUMABLE('missing_item')
  assert.equal(supplies.player.gold, afterEmpty)

  // 只在商店屏生效：路线、战斗、事件页都不能卖。
  for (const screen of ['route', 'reward', 'rest', 'meta', 'event', 'title']) {
    const elsewhere = fresh()
    elsewhere.screen = screen
    elsewhere._addConsumable('combo_scroll')
    const item = elsewhere._addEquipment(instance('epic'))
    elsewhere.SELL_CONSUMABLE('combo_scroll')
    elsewhere.SELL_EQUIPMENT(item)
    assert.deepEqual([elsewhere.player.gold, elsewhere.consumableCounts.combo_scroll, elsewhere.player.inventory], [0, 1, [item]], `${screen}: selling is shop-only`)
  }

  // 出售所得直接入账，不算消费：不会喂给「挥金如土」。
  const spender = fresh()
  spender.screen = 'shop'
  spender._grantUpgrade(cardById('spend_blade'))
  const attack = spender.player.attackMultiplier
  const treasure = spender._addEquipment(instance('epic'))
  spender.SELL_EQUIPMENT(treasure)
  assert.deepEqual([spender.player.gold, spender.runStats.goldSpent, spender.player.attackMultiplier], [60, 0, attack])

  // 刚买的装备可以按半价卖回：一买一卖净损失一半。
  const flipper = fresh()
  Object.assign(flipper, buildShop(createRng(11), 1, []))
  flipper.shopUpgrades = [null, null, null]; flipper.shopHeals = [null]; flipper.shopConsumables = [null, null]
  flipper.player.gold = 500
  flipper.screen = 'shop'
  const stock = flipper.shopEquipment.find(Boolean)
  const boughtPrice = equipment.equipCost(equipment.equipmentById(stock))
  flipper.BUY_SHOP_EQUIP(flipper.shopEquipment.indexOf(stock))
  assert.equal(flipper.player.gold, 500 - boughtPrice)
  assert.equal(flipper.player.inventory.length, 1)
  flipper.SELL_EQUIPMENT(flipper.player.inventory[0])
  assert.equal(flipper.player.gold, 500 - boughtPrice + boughtPrice / 2)
  assert.deepEqual(flipper.player.inventory, [])
}
