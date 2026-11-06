<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../../store/gameStore'
import { UPGRADE_POOL, rarityText, upgradeCost } from '../../core/upgrade'
import { equipmentById, formatEquipStats, equipCost, getSetData } from '../../core/equipment'
import ItemIcon from '../ItemIcon.vue'

const store = useGameStore()
const showRemove = ref(false)
const upgradeOf = (id: string | null) => UPGRADE_POOL.find(upgrade => upgrade.id === id)
const upgrades = computed(() => store.shopUpgrades.map((id, index) => {
  const def = upgradeOf(id)
  const count = store.upgrades.find(upgrade => upgrade.def.id === id)?.count ?? 0
  return { id, index, def, price: upgradeCost(def), capped: Boolean(def && count >= def.maxStacks) }
}))
const equipment = computed(() => store.shopEquipment.map((id, index) => ({
  id, index, def: id ? equipmentById(id) : undefined, lines: id ? formatEquipStats(id) : [],
  level: id ? parseInt(id.split(':')[1] || '1', 10) || 1 : 1, price: equipCost(id ? equipmentById(id) : undefined),
})))
const heals = computed(() => store.shopHeals.map((id, index) => {
  const def = upgradeOf(id)
  return { id, index, def, price: Math.floor((def?.effect.value ?? 0) * 1.5) }
}))
const removable = computed(() => store.upgrades.filter(upgrade => upgrade.def.effect.type !== 'heal'))
const cannotRefresh = computed(() => store.player.gold < store.shopRefreshCost)
const cannotRemove = computed(() => store.shopRemoveUsed || store.player.gold < store.shopRemoveCost || removable.value.length === 0)
function removeUpgrade(id: string) {
  if (cannotRemove.value) return
  store.SHOP_REMOVE_UPGRADE(id)
  showRemove.value = false
}
</script>

<template>
  <view class="screen shop-screen">
    <view class="ui-page shop-content">
      <view class="shop-header"><view><text class="ui-kicker">地牢补给站</text><text class="ui-title">旅途商店</text></view><view class="shop-wallet"><text class="shop-wallet-label">持有金币</text><text class="shop-wallet-value">{{ store.player.gold }}</text></view></view>
      <image class="art-scene shop-scene" src="/static/scenes/shop.png" mode="aspectFill" alt="" aria-hidden="true" />
      <view class="shop-refresh-bar art-card"><view><text class="shop-refresh-title">刷新全部商品</text><text class="ui-note">强化、装备与药水一起更新 · 已刷新 {{ store.shopRefreshCount }} 次</text></view><button role="button" class="shop-refresh-btn" :disabled="cannotRefresh" @click="store.REFRESH_SHOP()">{{ cannotRefresh ? '金币不足' : '刷新' }}<text>{{ store.shopRefreshCost }} 金币</text></button></view>
      <view class="shop-section">
        <view class="shop-section-header"><text class="shop-section-title">本局强化</text><text class="ui-note">购买后立即生效</text></view>
        <view class="shop-goods">
          <view v-for="item in upgrades" :key="`upgrade-${store.shopRefreshCount}-${item.index}`" class="shop-card art-card" :class="item.def ? `shop-rarity-${item.def.rarity}` : 'shop-sold'">
            <template v-if="item.id && item.def">
              <view class="shop-card-header"><text class="shop-rarity art-paper-label">{{ rarityText(item.def.rarity) }}</text><text class="shop-type">强化</text></view>
              <view class="shop-item-art"><ItemIcon :upgrade-type="item.def.effect.type" :rarity="item.def.rarity" size="normal" /></view>
              <text class="shop-card-name">{{ item.def.name }}</text><text class="shop-card-desc">{{ item.def.description }}</text>
              <button role="button" class="shop-buy" :disabled="item.capped || store.player.gold < item.price" @click="store.BUY_SHOP_UPGRADE(item.index)"><text>{{ item.capped ? '已达叠加上限' : store.player.gold < item.price ? '金币不足' : '购买' }}</text><text v-if="!item.capped">{{ item.price }} 金币</text></button>
            </template>
            <template v-else><text class="shop-sold-mark">—</text><text class="ui-note">已售出</text></template>
          </view>
        </view>
      </view>
      <view class="shop-section">
        <view class="shop-section-header"><text class="shop-section-title">装备</text><text class="ui-note">购买后放入背包</text></view>
        <view class="shop-goods">
          <view v-for="item in equipment" :key="`equipment-${store.shopRefreshCount}-${item.index}`" class="shop-card art-card" :class="item.def ? `shop-rarity-${item.def.rarity}` : 'shop-sold'">
            <template v-if="item.id && item.def">
              <view class="shop-card-header"><text class="shop-rarity art-paper-label">{{ rarityText(item.def.rarity) }}</text><text class="shop-type">Lv.{{ item.level }}</text></view>
              <view class="shop-item-art"><ItemIcon :slot="item.def.slot" :set-id="item.def.set" :rarity="item.def.rarity" size="normal" /></view>
              <text class="shop-card-name">{{ item.def.name }}</text><text class="shop-type">{{ item.def.set ? `${getSetData(item.def.set)?.name ?? ''}套装` : '独立装备' }}</text>
              <view class="shop-equip-lines"><text v-for="line in item.lines" :key="line" class="shop-card-desc">{{ line }}</text></view>
              <button role="button" class="shop-buy" :disabled="store.player.gold < item.price" @click="store.BUY_SHOP_EQUIP(item.index)"><text>{{ store.player.gold < item.price ? '金币不足' : '购买' }}</text><text>{{ item.price }} 金币</text></button>
            </template>
            <template v-else><text class="shop-sold-mark">—</text><text class="ui-note">已售出</text></template>
          </view>
        </view>
      </view>
      <view class="shop-section"><text class="shop-section-title">补给与整备</text><view class="shop-services">
        <view v-for="item in heals" :key="`heal-${store.shopRefreshCount}-${item.index}`" class="shop-card art-card shop-heal" :class="{ 'shop-sold': !item.id }">
          <template v-if="item.id && item.def">
            <view class="shop-card-header"><text class="shop-rarity art-paper-label">生命补给</text><ItemIcon :upgrade-type="item.def.effect.type" :rarity="item.def.rarity" size="small" /></view>
            <text class="shop-card-name">{{ item.def.name }}</text><text class="shop-card-desc">{{ item.def.description }}</text>
            <button role="button" class="shop-buy" :disabled="store.player.gold < item.price || store.effectivePlayer.hp >= store.effectivePlayer.maxHp" @click="store.BUY_SHOP_HEAL(item.index)"><text>{{ store.effectivePlayer.hp >= store.effectivePlayer.maxHp ? '生命已满' : store.player.gold < item.price ? '金币不足' : '购买并使用' }}</text><text>{{ item.price }} 金币</text></button>
          </template><text v-else class="ui-note">药水已售出</text>
        </view>
        <view class="shop-card art-card shop-remove"><text class="shop-rarity art-paper-label">本店限一次</text><text class="shop-card-name">移除强化</text><text class="shop-card-desc">选择一项强化移除一层。先查看，再决定。</text><button role="button" class="shop-buy" :disabled="cannotRemove" @click="showRemove = true"><text>{{ store.shopRemoveUsed ? '本店已使用' : !removable.length ? '暂无可移除强化' : store.player.gold < store.shopRemoveCost ? '金币不足' : '选择强化' }}</text><text v-if="!store.shopRemoveUsed">{{ store.shopRemoveCost }} 金币</text></button></view>
      </view></view>
      <button role="button" class="ui-btn ui-btn-secondary shop-leave" @click="store.GO_TO_ROUTE()">离开商店，继续前进</button>
    </view>
    <view v-if="showRemove" class="ui-overlay" @click="showRemove = false"><view class="ui-dialog" @click.stop>
      <view class="ui-sheet-header"><text class="ui-sheet-title">移除一层强化</text><button role="button" class="ui-close" @click="showRemove = false">取消</button></view><text class="ui-note shop-remove-note">每次花费 {{ store.shopRemoveCost }} 金币，不返还原购买价格。</text>
      <button role="button" v-for="upgrade in removable" :key="upgrade.def.id" class="shop-remove-option art-card" :disabled="cannotRemove" @click="removeUpgrade(upgrade.def.id)"><view class="shop-remove-identity"><ItemIcon :upgrade-type="upgrade.def.effect.type" :rarity="upgrade.def.rarity" size="small" /><text class="shop-card-name">{{ upgrade.def.name }} ×{{ upgrade.count }}</text></view><text class="shop-card-desc">{{ upgrade.def.description }}</text><text class="stat-gold">移除一层</text></button>
    </view></view>
  </view>
</template>

<style scoped lang="scss">
.shop-content { max-width: 820rpx; }
.shop-header { display: flex; justify-content: space-between; align-items: center; gap: 20rpx; margin-bottom: 28rpx; }
.shop-scene { margin-bottom: 22rpx; }
.shop-wallet { text-align: right; padding-left: 20rpx; border-left: 1px solid var(--line); }
.shop-wallet-label { display: block; color: var(--muted); font-size: 24rpx; }
.shop-wallet-value { color: var(--gold); font-size: 42rpx; font-weight: 800; }
.shop-refresh-bar { display: flex; justify-content: space-between; align-items: center; gap: 20rpx; padding: 20rpx; border-radius: 14rpx; background-color: var(--surface); border: 1px solid var(--line); margin-bottom: 30rpx; }
.shop-refresh-title { color: var(--text); font-size: 28rpx; font-weight: 700; }
.shop-refresh-btn { margin: 0; min-width: 148rpx; flex-shrink: 0; padding: 14rpx 18rpx; color: var(--accent); background: var(--accent-soft); border: 1px solid var(--line); border-radius: 10rpx; line-height: 1.4; font-size: 26rpx; }
.shop-refresh-btn text { display: block; font-size: 24rpx; margin-top: 4rpx; }
.shop-refresh-btn::after, .shop-buy::after, .shop-remove-option::after { border: none; }
.shop-refresh-btn[disabled] { color: var(--muted); background: var(--surface-soft); }
.shop-section { margin-bottom: 32rpx; }
.shop-section-header { display: flex; justify-content: space-between; align-items: baseline; gap: 16rpx; margin-bottom: 16rpx; }
.shop-section-title { display: block; color: var(--text); font-size: 32rpx; font-weight: 800; }
.shop-goods, .shop-services { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; }
.shop-services { margin-top: 16rpx; }
.shop-card { display: flex; flex-direction: column; gap: 10rpx; min-width: 0; padding: 20rpx; border: 1px solid var(--line); border-top: 3rpx solid var(--rarity-common); border-radius: 16rpx; background-color: var(--surface); box-shadow: var(--shadow); animation: ui-rise-in 180ms ease-out; }
.shop-rarity-rare { border-top-color: var(--rarity-rare); }
.shop-rarity-epic { border-top-color: var(--rarity-epic); }
.shop-rarity-rare .shop-rarity { color: var(--rarity-rare); }
.shop-rarity-epic .shop-rarity { color: var(--rarity-epic); }
.shop-card-header { display: flex; justify-content: space-between; align-items: center; gap: 8rpx; }
.shop-item-art { display: flex; justify-content: center; padding: 6rpx 0; }
.shop-rarity, .shop-type { font-size: 24rpx; line-height: 1.5; color: var(--muted); }
.shop-card-name { display: block; font-size: 30rpx; line-height: 1.45; font-weight: 800; color: var(--text); overflow-wrap: anywhere; }
.shop-card-desc { display: block; font-size: 26rpx; line-height: 1.65; color: var(--muted); white-space: normal; }
.shop-equip-lines { margin-bottom: 12rpx; }
.shop-buy { display: flex; justify-content: space-between; align-items: center; gap: 8rpx; flex-wrap: wrap; margin: auto 0 0; min-height: 76rpx; padding: 14rpx 10rpx; font-size: 26rpx; line-height: 1.4; color: var(--gold); background: var(--gold-soft); border: 1px solid var(--line); border-radius: 10rpx; }
.shop-buy[disabled] { color: var(--muted); background: var(--surface-soft); }
.shop-sold { min-height: 180rpx; align-items: center; justify-content: center; box-shadow: none; background: var(--surface-soft); border-style: dashed; border-top-width: 1px; }
.shop-sold-mark { font-size: 36rpx; color: var(--dim); }
.shop-heal { border-top-color: var(--hp); }
.shop-heal .shop-rarity { color: var(--hp); }
.shop-remove { border-top-color: var(--attack); }
.shop-remove .shop-rarity { color: var(--attack); }
.shop-leave { width: 100%; margin-top: 18rpx; }
.shop-remove-note { margin-bottom: 24rpx; }
.shop-remove-option { margin: 0 0 12rpx; padding: 20rpx; border: 1px solid var(--line); border-radius: 12rpx; background-color: var(--surface-soft); color: var(--text); display: flex; flex-direction: column; gap: 12rpx; font-size: 26rpx; line-height: 1.6; text-align: left; }
.shop-remove-identity { display: flex; align-items: center; gap: 12rpx; }
@media (max-width: 360px) { .shop-goods, .shop-services { grid-template-columns: minmax(0, 1fr); } }
@media (max-height: 700px) { .shop-scene { margin-bottom: 16rpx; } }
@media (prefers-reduced-motion: reduce) { .shop-card { animation: none; } }
</style>
