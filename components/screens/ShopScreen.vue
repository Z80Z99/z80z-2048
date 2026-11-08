<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useFeedback } from '../../composables/useFeedback'
import { useModalMotion } from '../../composables/usePanelMotion'
import { summarizeConsumable } from '../../utils/displayText'
import type { SummaryLine } from '../../utils/displayText'
import { useGameStore } from '../../store/gameStore'
import { cardById, canRemoveCard, upgradeCost } from '../../core/upgrade'
import { consumableById } from '../../core/consumables'
import CardIcon from '../CardIcon.vue'
import CardDetails from '../CardDetails.vue'
import { equipmentById, formatEquipStats, equipCost, getSetData } from '../../core/equipment'
import type { EquipSlot } from '../../core/equipment'
import ItemIcon from '../ItemIcon.vue'
import type { CardClass, CardEffect, ConsumableDef, EquipRarity } from '../../types'

const store = useGameStore()
const feedback = useFeedback()
const reduced = inject('motionReduced', ref(false))
const removeMotion = useModalMotion(reduced)
const detailMotion = useModalMotion(reduced)
const upgradeOf = (id: string | null) => id ? cardById(id) : undefined
const equipRarityText = (rarity: string) => ({ common: '普通', rare: '稀有', epic: '史诗' } as Record<string, string>)[rarity] ?? rarity
const upgrades = computed(() => store.shopUpgrades.map((id, index) => {
  const def = upgradeOf(id)
  const count = store.upgrades.find(upgrade => upgrade.def.id === id)?.count ?? 0
  const price = def ? upgradeCost(def) : null
  return { id, index, def, count, price, eligible: Boolean(def && def.kind === 'persistent' && ['white', 'blue', 'gold'].includes(def.cardClass) && price !== null) }
}))
const equipment = computed(() => store.shopEquipment.map((id, index) => ({
  id, index, def: id ? equipmentById(id) : undefined, lines: id ? formatEquipStats(id) : [],
  level: id ? parseInt(id.split(':')[1] || '1', 10) || 1 : 1, price: equipCost(id ? equipmentById(id) : undefined),
})))
const heals = computed(() => store.shopHeals.map((id, index) => {
  const def = upgradeOf(id)
  return { id, index, def, price: id ? store.shopHealPrice(id) : 0 }
}))
const consumables = computed(() => store.shopConsumables.map((id, index) => ({ id, index, def: id ? consumableById(id) : undefined })))
const removable = computed(() => store.upgrades.filter(upgrade => canRemoveCard(upgrade.def, 'shop')))
const cannotRefresh = computed(() => store.player.gold < store.shopRefreshCost)
const cannotRemove = computed(() => store.shopRemoveUsed || store.player.gold < store.shopRemoveCost || removable.value.length === 0)
type DetailSection = 'upgrade' | 'equipment' | 'consumable' | 'heal'
const detail = ref<{ section: DetailSection; index: number } | null>(null)
interface ShopDetailView {
  section: DetailSection
  sold: boolean
  name: string
  price: number | null
  disabledReason: string | null
  buyLabel: string
  cardClass?: CardClass
  icon?: string
  effects?: CardEffect[]
  kind?: 'persistent' | 'instant'
  count?: number
  duration?: ConsumableDef['duration']
  summaryLines?: SummaryLine[]
  owned?: number
  equipSlot?: EquipSlot
  setId?: string
  rarity?: EquipRarity
  level?: number
  setName?: string
  lines?: string[]
}
const soldDetail = (section: DetailSection): ShopDetailView => ({ section, sold: true, name: '', price: null, disabledReason: null, buyLabel: '' })
const detailView = computed<ShopDetailView | null>(() => {
  if (!detail.value) return null
  const { section, index } = detail.value
  const gold = store.player.gold
  if (section === 'upgrade') {
    const id = store.shopUpgrades[index]
    const def = upgradeOf(id)
    if (!id || !def) return soldDetail(section)
    const price = upgradeCost(def)
    const eligible = def.kind === 'persistent' && ['white', 'blue', 'gold'].includes(def.cardClass) && price !== null
    return {
      section, sold: false, name: def.name, price: eligible ? price : null, buyLabel: '购买',
      cardClass: def.cardClass, icon: def.icon, effects: def.effects, kind: def.kind,
      count: store.upgrades.find(upgrade => upgrade.def.id === id)?.count ?? 0,
      disabledReason: !eligible ? '不在常规商店出售' : price !== null && gold < price ? '金币不足' : null,
    }
  }
  if (section === 'equipment') {
    const id = store.shopEquipment[index]
    const def = id ? equipmentById(id) : undefined
    if (!id || !def) return soldDetail(section)
    const price = equipCost(def)
    return {
      section, sold: false, name: def.name, price, buyLabel: '购买，放入背包',
      equipSlot: def.slot, setId: def.set, rarity: def.rarity,
      level: parseInt(id.split(':')[1] || '1', 10) || 1,
      setName: def.set ? `${getSetData(def.set)?.name ?? ''}套装` : '独立装备',
      lines: formatEquipStats(id),
      disabledReason: gold < price ? '金币不足' : null,
    }
  }
  if (section === 'consumable') {
    const id = store.shopConsumables[index]
    const def = id ? consumableById(id) : undefined
    if (!id || !def) return soldDetail(section)
    return {
      section, sold: false, name: def.name, price: def.price, buyLabel: '购买并携带',
      cardClass: def.cardClass, icon: def.icon, summaryLines: summarizeConsumable(def), duration: def.duration,
      owned: store.consumableCounts[id] ?? 0,
      disabledReason: gold < def.price ? '金币不足' : null,
    }
  }
  const id = store.shopHeals[index]
  const def = upgradeOf(id)
  if (!id || !def) return soldDetail(section)
  const price = store.shopHealPrice(id)
  return {
    section: 'heal', sold: false, name: def.name, price, buyLabel: '购买并使用',
    cardClass: def.cardClass, icon: def.icon, effects: def.effects, kind: def.kind,
    disabledReason: store.effectivePlayer.hp >= store.effectivePlayer.maxHp ? '生命已满' : gold < price ? '金币不足' : null,
  }
})
const detailSlots = () => ({ upgrade: store.shopUpgrades, equipment: store.shopEquipment, consumable: store.shopConsumables, heal: store.shopHeals })
function openDetail(section: DetailSection, index: number) {
  if (detailMotion.closing.value) return
  if (!detailSlots()[section][index]) return
  detail.value = { section, index }
  detailMotion.open()
}
function buyFromDetail() {
  const target = detail.value
  if (detailMotion.closing.value || !target) return
  buy(target.section, target.index)
  if (!detailSlots()[target.section][target.index]) detailMotion.close()
}
watch(detailMotion.mounted, mounted => { if (!mounted) detail.value = null })
function removeUpgrade(id: string) {
  if (removeMotion.closing.value || cannotRemove.value) return
  const before = store.upgrades.find(upgrade => upgrade.def.id === id)?.count ?? 0
  store.SHOP_REMOVE_UPGRADE(id)
  if ((store.upgrades.find(upgrade => upgrade.def.id === id)?.count ?? 0) < before) {
    feedback.show('已移除一层强化')
    removeMotion.close()
  }
}
function buy(kind: 'upgrade' | 'equipment' | 'heal' | 'consumable', index: number) {
  const slots = { upgrade: store.shopUpgrades, equipment: store.shopEquipment, heal: store.shopHeals, consumable: store.shopConsumables }
  const id = slots[kind][index]
  if (!id) return
  const beforeHp = store.player.hp
  if (kind === 'upgrade') store.BUY_SHOP_UPGRADE(index)
  else if (kind === 'equipment') store.BUY_SHOP_EQUIP(index)
  else if (kind === 'heal') store.BUY_SHOP_HEAL(index)
  else store.BUY_SHOP_CONSUMABLE(index)
  const afterSlots = { upgrade: store.shopUpgrades, equipment: store.shopEquipment, heal: store.shopHeals, consumable: store.shopConsumables }
  if (afterSlots[kind][index] === null) feedback.show(kind === 'heal' ? `恢复${store.player.hp - beforeHp}点生命` : kind === 'equipment' || kind === 'consumable' ? '已购买，放入背包' : '已获得强化')
}
function refreshShop() {
  const before = store.shopRefreshCount
  store.REFRESH_SHOP()
  if (store.shopRefreshCount > before) feedback.show('商品已刷新')
}
</script>

<template>
  <view class="screen shop-screen">
    <view class="ui-page shop-content">
      <view class="shop-header"><view><text class="ui-kicker">地牢补给站</text><text class="ui-title">旅途商店</text></view><view class="shop-wallet"><text class="shop-wallet-label">持有金币</text><text class="shop-wallet-value">{{ store.player.gold }}</text></view></view>
      <image class="art-scene shop-scene" src="/static/scenes/shop.png" mode="aspectFill" alt="" aria-hidden="true" />
      <text v-if="feedback.text.value" :key="feedback.revision.value" class="shop-notice ui-feedback" role="status">{{ feedback.text.value }}</text>
      <view class="shop-refresh-bar art-card"><view><text class="shop-refresh-title">刷新全部商品</text><text class="ui-note">强化、装备、即时补给与道具一起更新 · 已刷新 {{ store.shopRefreshCount }} 次</text></view><button role="button" class="shop-refresh-btn" :disabled="cannotRefresh" @click="refreshShop">{{ cannotRefresh ? '金币不足' : '刷新' }}<text>{{ store.shopRefreshCost }} 金币</text></button></view>
      <view class="shop-section">
        <view class="shop-section-header"><text class="shop-section-title">本局强化</text><text class="ui-note">点击商品查看效果与价格</text></view>
        <view class="shop-goods">
          <view v-for="item in upgrades" :key="`upgrade-${store.shopRefreshCount}-${item.index}`" class="shop-card art-card card-tone card-frame ui-entry ui-press" :class="item.def ? `card-${item.def.cardClass}` : 'shop-sold'" :role="item.def ? 'button' : undefined" :tabindex="item.def ? 0 : undefined" :aria-label="item.def ? `查看${item.def.name}的效果与价格` : undefined" @click="openDetail('upgrade', item.index)">
            <template v-if="item.id && item.def">
              <view class="shop-item-art"><CardIcon :icon="item.def.icon" :card-class="item.def.cardClass" /></view>
              <text class="shop-card-name">{{ item.def.name }}</text>
              <text class="shop-price" :class="{ 'shop-price-unavailable': !item.eligible }">{{ item.eligible ? `${item.price} 金币` : '不可购买' }}</text>
            </template>
            <template v-else><text class="shop-sold-mark">—</text><text class="ui-note">已售出</text></template>
          </view>
        </view>
      </view>
      <view class="shop-section">
        <view class="shop-section-header"><text class="shop-section-title">装备</text><text class="ui-note">点击查看属性 · 购买后放入背包</text></view>
        <view class="shop-goods">
          <view v-for="item in equipment" :key="`equipment-${store.shopRefreshCount}-${item.index}`" class="shop-card art-card ui-entry ui-press" :class="item.def ? `shop-rarity-${item.def.rarity}` : 'shop-sold'" :role="item.def ? 'button' : undefined" :tabindex="item.def ? 0 : undefined" :aria-label="item.def ? `查看${item.def.name}的属性与价格` : undefined" @click="openDetail('equipment', item.index)">
            <template v-if="item.id && item.def">
              <view class="shop-item-art"><ItemIcon :slot="item.def.slot" :set-id="item.def.set" :rarity="item.def.rarity" size="normal" /></view>
              <text class="shop-card-name">{{ item.def.name }}</text>
              <text class="shop-price">{{ item.price }} 金币</text>
            </template>
            <template v-else><text class="shop-sold-mark">—</text><text class="ui-note">已售出</text></template>
          </view>
        </view>
      </view>
      <view class="shop-section">
        <view class="shop-section-header"><text class="shop-section-title">道具</text><text class="ui-note">点击查看效果 · 购买后可携带到战斗</text></view>
        <view class="shop-goods">
          <view v-for="item in consumables" :key="`consumable-${store.shopRefreshCount}-${item.index}`" class="shop-card art-card card-tone card-frame ui-entry ui-press" :class="item.def ? `card-${item.def.cardClass}` : 'shop-sold'" :role="item.def ? 'button' : undefined" :tabindex="item.def ? 0 : undefined" :aria-label="item.def ? `查看${item.def.name}的效果与价格` : undefined" @click="openDetail('consumable', item.index)">
            <template v-if="item.id && item.def">
              <view class="shop-item-art"><CardIcon :icon="item.def.icon" :card-class="item.def.cardClass" /></view>
              <text class="shop-card-name">{{ item.def.name }}</text>
              <text class="shop-price">{{ item.def.price }} 金币</text>
            </template>
            <template v-else><text class="shop-sold-mark">—</text><text class="ui-note">道具已售出</text></template>
          </view>
        </view>
      </view>
      <view class="shop-section"><text class="shop-section-title">即时补给与整备</text><view class="shop-services">
        <view v-for="item in heals" :key="`heal-${store.shopRefreshCount}-${item.index}`" class="shop-card art-card shop-heal ui-entry ui-press" :class="{ 'shop-sold': !item.id }" :role="item.id && item.def ? 'button' : undefined" :tabindex="item.id && item.def ? 0 : undefined" :aria-label="item.id && item.def ? `查看${item.def.name}的效果与价格` : undefined" @click="openDetail('heal', item.index)">
          <template v-if="item.id && item.def">
            <view class="shop-item-art"><CardIcon :icon="item.def.icon" :card-class="item.def.cardClass" /></view>
            <text class="shop-card-name">{{ item.def.name }}</text>
            <text class="shop-price">{{ item.price }} 金币</text>
          </template>
          <template v-else><text class="shop-sold-mark">—</text><text class="ui-note">药水已售出</text></template>
        </view>
        <view class="shop-card art-card shop-remove ui-press" role="button" tabindex="0" aria-label="查看移除强化的说明与价格" @click="removeMotion.open()"><text class="shop-card-name">移除强化</text><text class="shop-price" :class="{ 'shop-price-unavailable': cannotRemove }">{{ store.shopRemoveUsed ? '本店已使用' : `${store.shopRemoveCost} 金币` }}</text></view>
      </view></view>
      <button role="button" class="ui-btn ui-btn-secondary shop-leave" @click="store.GO_TO_ROUTE()">离开商店，继续前进</button>
    </view>
    <view v-if="detailMotion.mounted.value" class="ui-overlay" :class="{ 'ui-motion-closing': detailMotion.closing.value }" @click="detailMotion.close()"><view class="ui-dialog" @click.stop>
      <template v-if="detailView && !detailView.sold">
        <view class="ui-sheet-header"><text class="ui-sheet-title">{{ detailView.name }}</text><button role="button" class="ui-close" @click="detailMotion.close()">关闭</button></view>
        <view class="shop-detail-art" :class="detailView.cardClass ? `card-${detailView.cardClass}` : ''">
          <CardIcon v-if="detailView.icon" :icon="detailView.icon" :card-class="detailView.cardClass" />
          <ItemIcon v-else-if="detailView.section === 'equipment'" :slot="detailView.equipSlot" :set-id="detailView.setId" :rarity="detailView.rarity" />
        </view>
        <view v-if="detailView.section === 'equipment'" class="shop-detail-meta">
          <text class="shop-rarity art-paper-label">{{ equipRarityText(detailView.rarity ?? 'common') }}</text>
          <text class="shop-type">Lv.{{ detailView.level }}</text>
          <text class="shop-type">{{ detailView.setName }}</text>
        </view>
        <CardDetails v-if="detailView.effects" :card-class="detailView.cardClass ?? 'white'" :effects="detailView.effects" :kind="detailView.kind" :count="detailView.count" :compact="false" :show-help="false" :context="{ effectivePlayer: store.effectivePlayer, modifiers: { healingPenalty: store.activeCardModifiers.healingPenalty } }" />
        <view v-if="detailView.lines?.length" class="shop-equip-lines"><text v-for="line in detailView.lines" :key="line" class="shop-card-desc">{{ line }}</text></view>
        <CardDetails v-if="detailView.summaryLines" :card-class="detailView.cardClass ?? 'white'" :effects="[]" :summary-lines="detailView.summaryLines" :duration="detailView.duration" :compact="false" :show-help="false" />
        <text v-if="detailView.owned" class="shop-type">已持有 {{ detailView.owned }} 件</text>
        <button role="button" class="shop-buy ui-press" :disabled="Boolean(detailView.disabledReason)" @click="buyFromDetail"><text>{{ detailView.disabledReason ?? detailView.buyLabel }}</text><text v-if="detailView.price !== null">{{ detailView.price }} 金币</text></button>
      </template>
      <template v-else>
        <view class="ui-sheet-header"><text class="ui-sheet-title">商品详情</text><button role="button" class="ui-close" @click="detailMotion.close()">关闭</button></view>
        <text class="ui-note">该商品已售出。</text>
      </template>
    </view></view>
    <view v-if="removeMotion.mounted.value" class="ui-overlay" :class="{ 'ui-motion-closing': removeMotion.closing.value }" @click="removeMotion.close()"><view class="ui-dialog" @click.stop>
      <view class="ui-sheet-header"><text class="ui-sheet-title">移除一层强化</text><button role="button" class="ui-close" @click="removeMotion.close()">取消</button></view><text class="ui-note shop-remove-note">本店限一次。每次花费 {{ store.shopRemoveCost }} 金币，不返还原购买价格；紫卡需净化，黑卡本局不可解除。</text>
      <button role="button" v-for="upgrade in removable" :key="upgrade.def.id" class="shop-remove-option art-card" :disabled="cannotRemove" @click="removeUpgrade(upgrade.def.id)"><view class="shop-remove-identity"><CardIcon :icon="upgrade.def.icon" :card-class="upgrade.def.cardClass" size="small" /><text class="shop-card-name">{{ upgrade.def.name }} ×{{ upgrade.count }}</text></view><CardDetails :card-class="upgrade.def.cardClass" :effects="upgrade.def.effects" :kind="upgrade.def.kind" /><text class="stat-gold">移除一层</text></button>
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
.shop-goods, .shop-services { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 14rpx; }
.shop-services { margin-top: 16rpx; }
.shop-card { display: flex; flex-direction: column; gap: 10rpx; min-width: 0; padding: 20rpx; border: 1px solid var(--line); border-top: 3rpx solid var(--rarity-common); border-radius: 16rpx; background-color: var(--surface); box-shadow: var(--shadow); }
.shop-rarity-rare { border-top-color: var(--rarity-rare); }
.shop-rarity-epic { border-top-color: var(--rarity-epic); }
.shop-rarity-rare .shop-rarity { color: var(--rarity-rare); }
.shop-rarity-epic .shop-rarity { color: var(--rarity-epic); }
.shop-card-header { display: flex; justify-content: space-between; align-items: center; gap: 8rpx; }
.shop-item-art { display: flex; justify-content: center; padding: 6rpx 0; }
.shop-price { align-self: flex-start; padding: 4rpx 12rpx; border: 1rpx solid var(--line); border-radius: 6rpx; background: var(--gold-soft); color: var(--gold); font-size: 24rpx; line-height: 1.5; }
.shop-price-unavailable { color: var(--muted); background: var(--surface-soft); }
.shop-card[tabindex='0']:focus-visible { outline: 3rpx dashed var(--accent); outline-offset: 2rpx; }
.shop-detail-art { display: flex; justify-content: center; padding: 6rpx 0 16rpx; }
.shop-detail-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx 14rpx; margin-bottom: 6rpx; }
.shop-rarity, .shop-type { font-size: 24rpx; line-height: 1.5; color: var(--muted); }
.shop-card-name { display: block; font-size: 30rpx; line-height: 1.45; font-weight: 800; color: var(--text); overflow-wrap: anywhere; }
.shop-card-desc { display: block; font-size: 26rpx; line-height: 1.65; color: var(--muted); white-space: normal; }
.shop-equip-lines { margin-bottom: 12rpx; }
.shop-buy { display: flex; justify-content: space-between; align-items: center; gap: 8rpx; flex-wrap: wrap; margin: auto 0 0; min-height: 76rpx; padding: 14rpx 10rpx; font-size: 26rpx; line-height: 1.4; color: var(--gold); background: var(--gold-soft); border: 1px solid var(--line); border-radius: 10rpx; }
.shop-buy[disabled] { color: var(--muted); background: var(--surface-soft); }
.shop-sold { align-items: center; justify-content: center; box-shadow: none; background: var(--surface-soft); border-style: dashed; border-top-width: 1px; }
.shop-sold-mark { font-size: 36rpx; color: var(--dim); }
.shop-heal { border-top-color: var(--hp); }
.shop-remove { border-top-color: var(--attack); }
.shop-leave { width: 100%; margin-top: 18rpx; }
.shop-remove-note { margin-bottom: 24rpx; }
.shop-remove-option { margin: 0 0 12rpx; padding: 20rpx; border: 1px solid var(--line); border-radius: 12rpx; background-color: var(--surface-soft); color: var(--text); display: flex; flex-direction: column; gap: 12rpx; font-size: 26rpx; line-height: 1.6; text-align: left; }
.shop-remove-identity { display: flex; align-items: center; gap: 12rpx; }
@media (max-width: 360px) { .shop-goods, .shop-services { grid-template-columns: minmax(0, 1fr); } }
@media (max-height: 700px) { .shop-scene { margin-bottom: 16rpx; } }
.shop-notice { display: block; color: var(--hp); font-size: 26rpx; margin: 10rpx 0; }
@media (prefers-reduced-motion: reduce) { .shop-card, .shop-notice { animation: none; } }
</style>
