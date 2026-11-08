import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

export async function run() {
  const root = path.resolve(import.meta.dirname, '../..')
  const shop = fs.readFileSync(path.join(root, 'components/screens/ShopScreen.vue'), 'utf8')
  // 货架网格所有行等高，已售出占位不再比在售商品矮一截。
  assert.match(shop, /\.shop-goods, \.shop-services \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); grid-auto-rows: 1fr;/, 'shop rows stay equal height')
  assert.ok(!shop.includes('min-height: 180rpx'), 'sold placeholder no longer forces its own height')
  // 售出占位统一为“— 已售出”，道具与药水不再各写一套。
  assert.equal((shop.match(/<text class="shop-sold-mark">/g) || []).length, 4, 'every sold slot reuses the same dash mark')
  assert.ok(!shop.includes('<text v-else class="ui-note">道具已售出</text>'), 'consumable sold slot uses shared markup')
  assert.ok(!shop.includes('<text v-else class="ui-note">药水已售出</text>'), 'heal sold slot uses shared markup')
  // 卡面只保留图标、名字与价格；完整效果只在弹窗内渲染（详情弹窗 2 处 + 移除强化弹窗 1 处），购买只在弹窗内发生。
  assert.equal((shop.match(/<CardDetails/g) || []).length, 3, 'card effects render only inside dialogs')
  assert.equal((shop.match(/class="shop-buy /g) || []).length, 1, 'the detail dialog hosts the only buy button')
  assert.ok(!shop.includes('@click="buy('), 'card faces never buy directly')
  assert.equal((shop.match(/openDetail\('/g) || []).length, 4, 'every goods section opens the detail dialog')
  assert.ok(shop.includes('buyFromDetail'), 'dialog purchase routes through the shared buy flow')
  assert.ok(shop.includes(':compact="false"'), 'dialog shows full effect text')
  assert.equal((shop.match(/:show-help="false"/g) || []).length, 2, 'shop dialog omits quality and stacking help notes')
}
