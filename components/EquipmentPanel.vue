<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useFeedback } from '../composables/useFeedback'
import { useGameStore } from '../store/gameStore'
import { equipmentById, formatEquipStats, computeEquipBonuses, getSetData } from '../core/equipment'
import type { EquipSlot, SortMode } from '../core/equipment'
import ItemIcon from './ItemIcon.vue'

const emit = defineEmits<{ close: [] }>()
const store = useGameStore()
const player = computed(() => store.effectivePlayer)
const locked = computed(() => store.screen === 'battle' || Boolean(store.eventResult))
const lockMessage = computed(() => store.screen === 'battle' ? '战斗期间可查看装备；战斗结束后才能更换或卸下。' : '事件结果等待确认，继续前进后才能更换或卸下装备。')
const sortOpen = ref(false)
const activeTab = ref<'inventory' | 'sets'>('inventory')
const feedback = useFeedback()
const touchedSlot = ref<EquipSlot | null>(null)
const showAttributeHelp = inject<(key: string) => void>('show-attribute-help', () => {})
const slotDefs: { key: EquipSlot; name: string }[] = [
  { key: 'helmet', name: '头盔' }, { key: 'armor', name: '铠甲' },
  { key: 'gloves', name: '手套' }, { key: 'pants', name: '护腿' }, { key: 'boots', name: '战靴' },
]
const sortModes: { mode: SortMode; label: string }[] = [
  { mode: 'quality', label: '品质优先' }, { mode: 'level', label: '等级优先' }, { mode: 'slot', label: '部位优先' },
  { mode: 'name', label: '名称排序' }, { mode: 'set', label: '套装优先' },
]
const rarityLabels: Record<string, string> = { common: '普通', rare: '稀有', epic: '史诗' }
function itemOf(compoundId: string) {
  const item = equipmentById(compoundId)
  if (!item) return null
  return { ...item, compoundId, level: parseInt(compoundId.split(':')[1] || '1', 10) || 1, lines: formatEquipStats(compoundId) }
}
const inventory = computed(() => store.player.inventory.map((id, index) => ({ item: itemOf(id), index, key: `${id}-${index}` })).filter(entry => entry.item))
const equipped = computed(() => slotDefs.map(slot => {
  const id = store.player.equipment[slot.key]
  return { ...slot, item: id ? itemOf(id) : null }
}))
const setBonuses = computed(() => computeEquipBonuses(store.player.equipment))
const setGroups = computed(() => {
  const counts = new Map<string, number>()
  for (const slot of equipped.value) {
    if (slot.item?.set) counts.set(slot.item.set, (counts.get(slot.item.set) ?? 0) + 1)
  }
  return [...counts].map(([id, count]) => ({ id, count, data: getSetData(id) })).filter(group => group.data)
})
function isEquipped(id: string) { return Object.values(store.player.equipment).includes(id) }
function equip(id: string) {
  if (locked.value) return
  const def = equipmentById(id)
  if (!def) return
  const before = store.player.equipment[def.slot]
  store.EQUIP_ITEM(id)
  if (store.player.equipment[def.slot] === id && before !== id) {
    touchedSlot.value = def.slot
    feedback.show(`已装备 ${def.name}`)
  }
}
function unequip(slot: EquipSlot) {
  if (locked.value) return
  const before = store.player.equipment[slot]
  store.UNEQUIP_ITEM(slot)
  if (before && !store.player.equipment[slot]) {
    touchedSlot.value = slot
    feedback.show('装备已卸下，仍在背包中')
  }
}
</script>

<template>
  <view class="ui-overlay ui-sheet-overlay eq-overlay" @click="emit('close')">
    <view class="ui-sheet eq-panel" @click.stop>
      <view class="ui-sheet-header"><view><text class="ui-kicker">冒险者行装</text><text class="ui-sheet-title">装备与背包</text></view><button role="button" class="ui-close" @click="emit('close')">关闭</button></view>
      <view class="eq-effective">
        <text class="eq-effective-label">实际属性 · 已计入白卡、装备与套装</text>
        <view class="eq-stats"><view role="button" tabindex="0" class="stat-hp ui-press" @click="showAttributeHelp('player.hp')">生命 {{ player.hp }}/{{ player.maxHp }}</view><view role="button" tabindex="0" class="stat-attack ui-press" @click="showAttributeHelp('player.attack')">攻击 ×{{ player.attackMultiplier.toFixed(2) }}{{ player.flatAttack ? ` +${player.flatAttack}` : '' }}</view><view role="button" tabindex="0" class="stat-defense ui-press" @click="showAttributeHelp('player.defense')">防御 ×{{ player.defenseMultiplier.toFixed(2) }}{{ player.flatDefense ? ` +${player.flatDefense}` : '' }}</view><view role="button" tabindex="0" class="stat-speed ui-press" @click="showAttributeHelp('player.speed')">速度 {{ Number(player.baseSpeed.toFixed(2)) }}</view></view>
        <view class="eq-economy"><view role="button" tabindex="0" @click="showAttributeHelp('player.gold')">金币 +{{ Math.round(player.goldBoost * 100) }}%{{ setBonuses.setEffects.doubleGold ? ' · 结算翻倍' : '' }}</view><view role="button" tabindex="0" @click="showAttributeHelp('player.xp')">经验 +{{ Math.round(player.xpBoost * 100) }}%{{ setBonuses.setEffects.doubleXp ? ' · 结算翻倍' : '' }}</view></view>
        <text class="eq-effective-label">点属性查看说明。装备品质与卡牌颜色不同，紫框史诗装备不是诅咒。</text>
      </view>
      <text v-if="locked" class="eq-locked">{{ lockMessage }}</text>
      <text v-else-if="feedback.text.value" :key="feedback.revision.value" class="eq-notice ui-feedback" role="status">{{ feedback.text.value }}</text>
      <scroll-view class="ui-scroll" scroll-y>
        <text class="eq-section-title">已装备</text>
        <view class="eq-slots">
          <view v-for="slot in equipped" :key="slot.key" class="eq-slot art-card" :class="[slot.item ? `eq-rarity-${slot.item.rarity}` : 'eq-slot-empty', { 'ui-feedback': feedback.text.value && touchedSlot === slot.key }]">
            <view class="eq-slot-mark"><ItemIcon :slot="slot.item?.slot ?? slot.key" :set-id="slot.item?.set" :rarity="slot.item?.rarity" :show-quality="Boolean(slot.item)" :size="slot.item ? 'normal' : 'small'" /><text class="eq-slot-kind">{{ slot.name }}</text></view>
            <view class="eq-slot-main"><text class="eq-item-name">{{ slot.item ? slot.item.name : '空置' }}</text><text v-if="slot.item" class="eq-item-meta">Lv.{{ slot.item.level }} · {{ rarityLabels[slot.item.rarity] }}</text><text v-for="line in slot.item?.lines ?? []" :key="line" class="eq-item-stat">{{ line }}</text></view>
            <button role="button" v-if="slot.item" class="eq-small-btn" :disabled="locked" @click="unequip(slot.key)">卸下</button>
          </view>
        </view>
        <view class="eq-tabs"><button role="button" class="eq-tab" :class="{ 'eq-tab-active': activeTab === 'inventory' }" @click="activeTab = 'inventory'">背包 {{ inventory.length }}</button><button role="button" class="eq-tab" :class="{ 'eq-tab-active': activeTab === 'sets' }" @click="activeTab = 'sets'">套装效果 {{ setGroups.length }}</button></view>
        <template v-if="activeTab === 'inventory'">
          <view class="eq-inventory-heading"><text class="ui-note">点击装备，更换对应部位</text><button role="button" class="eq-small-btn" @click="sortOpen = !sortOpen">整理 {{ sortOpen ? '−' : '+' }}</button></view>
          <view v-if="sortOpen" class="eq-sort-options"><button role="button" v-for="mode in sortModes" :key="mode.mode" class="eq-sort-btn" @click="store.SORT_INVENTORY(mode.mode); sortOpen = false">{{ mode.label }}</button></view>
          <view v-if="!inventory.length" class="eq-empty"><text class="eq-empty-mark">◇</text><text class="ui-note">背包空空，战利品与商店会带来新的装备。</text></view>
          <view class="eq-inventory">
            <view v-for="entry in inventory" :key="entry.key" class="eq-inventory-item art-card" :class="`eq-rarity-${entry.item!.rarity}`">
              <view class="eq-item-top"><text class="eq-rarity-label art-paper-label">{{ rarityLabels[entry.item!.rarity] }} · Lv.{{ entry.item!.level }}</text><text class="eq-item-meta">{{ slotDefs.find(slot => slot.key === entry.item!.slot)?.name }}</text></view>
              <view class="eq-inventory-icon"><ItemIcon :slot="entry.item!.slot" :set-id="entry.item!.set" :rarity="entry.item!.rarity" size="normal" /></view>
              <text class="eq-item-name">{{ entry.item!.name }}</text>
              <text class="eq-item-meta">{{ entry.item!.set ? `${getSetData(entry.item!.set)?.name ?? ''}套装` : '独立装备 · 无套装效果' }}</text>
              <view class="eq-item-stats"><text v-for="line in entry.item!.lines" :key="line" class="eq-item-stat">{{ line }}</text></view>
              <button role="button" class="eq-equip-btn" :disabled="locked || isEquipped(entry.item!.compoundId)" @click="equip(entry.item!.compoundId)">{{ isEquipped(entry.item!.compoundId) ? '已装备' : locked ? '暂不可更换' : '装备' }}</button>
            </view>
          </view>
        </template>
        <template v-else>
          <text class="ui-note eq-set-note">同一套装跨等级计件，2 / 3 / 5 件效果依次生效。</text>
          <text v-if="!setGroups.length" class="ui-note eq-empty">尚未穿戴套装装备。</text>
          <view v-for="group in setGroups" :key="group.id" class="eq-set art-card">
            <view class="eq-set-title"><view class="eq-set-identity"><ItemIcon :set-id="group.id" size="small" /><text>{{ group.data!.name }}</text></view><text class="ui-badge">{{ group.count }} / 5 件</text></view>
            <text v-for="threshold in [2, 3, 5]" :key="threshold" class="eq-set-bonus" :class="{ 'eq-set-active': group.count >= threshold }">{{ group.count >= threshold ? '已激活' : '未激活' }} · {{ threshold }} 件 — {{ threshold === 2 ? group.data!.bonuses.two : threshold === 3 ? group.data!.bonuses.three : group.data!.bonuses.five }}</text>
          </view>
        </template>
        <view class="eq-bottom-space" />
      </scroll-view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.eq-overlay { z-index: 120; }
.eq-effective { padding: 18rpx; border: 1px solid var(--line); border-radius: 14rpx; background: var(--surface-soft); margin-bottom: 16rpx; }
.eq-effective-label { display: block; font-size: 24rpx; color: var(--muted); margin-bottom: 10rpx; }
.eq-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8rpx 16rpx; font-size: 26rpx; font-weight: 700; }
.eq-economy { display: block; margin-top: 10rpx; color: var(--gold); font-size: 26rpx; }
.eq-locked, .eq-notice { display: block; color: var(--accent); padding: 12rpx 16rpx; margin-bottom: 12rpx; background: var(--accent-soft); border-radius: 10rpx; font-size: 26rpx; line-height: 1.6; }
.eq-notice { color: var(--hp); background: var(--hp-soft); }
.eq-section-title { display: block; color: var(--muted); font-size: 26rpx; margin: 8rpx 0 14rpx; }
.eq-slots { display: flex; flex-direction: column; gap: 10rpx; }
.eq-slot { display: flex; align-items: center; gap: 18rpx; padding: 16rpx; border: 1px solid var(--line); border-left: 3rpx solid var(--line); border-radius: 12rpx; }
.eq-slot-mark { width: 88rpx; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 6rpx; text-align: center; }
.eq-slot-empty { box-sizing: border-box; min-height: 88rpx; padding: 12rpx 16rpx; }
.eq-slot-empty .eq-slot-mark { width: 142rpx; flex-direction: row; gap: 12rpx; }
.eq-slot-empty :deep(.item-icon) { opacity: 0.58; }
.eq-slot-empty .eq-item-name { color: var(--muted); font-size: 26rpx; font-weight: 400; }
.eq-slot-kind { display: block; font-size: 24rpx; color: var(--muted); }
.eq-inventory-icon { display: flex; justify-content: center; padding: 4rpx 0; }
.eq-set-identity { display: flex; align-items: center; gap: 12rpx; min-width: 0; }
.eq-set-identity text { overflow-wrap: anywhere; }
.eq-set-title .ui-badge { flex-shrink: 0; }
.eq-slot-main { flex: 1; min-width: 0; }
.eq-item-name { color: var(--text); font-size: 28rpx; font-weight: 800; display: block; line-height: 1.5; }
.eq-item-meta { display: block; color: var(--muted); font-size: 24rpx; line-height: 1.55; }
.eq-item-stat { display: block; color: var(--text); font-size: 26rpx; line-height: 1.6; }
.eq-small-btn, .eq-sort-btn { box-sizing: border-box; margin: 0; padding: 12rpx 18rpx; color: var(--accent); background: var(--accent-soft); border: 1px solid var(--line); border-radius: 10rpx; font-size: 26rpx; line-height: 1.4; }
.eq-small-btn::after, .eq-sort-btn::after, .eq-tab::after, .eq-equip-btn::after { border: none; }
.eq-small-btn[disabled] { color: var(--muted); background: var(--surface-soft); }
.eq-tabs { display: flex; gap: 12rpx; margin: 28rpx 0 18rpx; border-bottom: 1px solid var(--line); }
.eq-tab { flex: 1; margin: 0; padding: 16rpx 8rpx; color: var(--muted); background: none; border-bottom: 3rpx solid transparent; border-radius: 0; font-size: 28rpx; line-height: 1.5; }
.eq-tab-active { color: var(--accent); border-bottom-color: var(--accent); }
.eq-inventory-heading { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-bottom: 16rpx; }
.eq-sort-options { display: flex; flex-wrap: wrap; gap: 10rpx; padding: 12rpx 0 20rpx; }
.eq-empty { text-align: center; padding: 40rpx 16rpx; }
.eq-empty-mark { display: block; font-size: 52rpx; color: var(--accent); margin-bottom: 16rpx; }
.eq-inventory { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; }
.eq-inventory-item { padding: 18rpx; box-sizing: border-box; border: 1px solid var(--line); border-top: 3rpx solid var(--line); border-radius: 14rpx; background-color: var(--surface-soft); display: flex; flex-direction: column; gap: 10rpx; }
.eq-rarity-common { border-left-color: var(--rarity-common); }
.eq-inventory-item.eq-rarity-common { border-top-color: var(--rarity-common); }
.eq-rarity-rare { border-left-color: var(--rarity-rare); }
.eq-inventory-item.eq-rarity-rare { border-top-color: var(--rarity-rare); }
.eq-rarity-epic { border-left-color: var(--rarity-epic); }
.eq-inventory-item.eq-rarity-epic { border-top-color: var(--rarity-epic); }
.eq-item-top { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6rpx; }
.eq-rarity-label { font-size: 24rpx; color: var(--muted); }
.eq-rarity-rare .eq-rarity-label { color: var(--rarity-rare); }
.eq-rarity-epic .eq-rarity-label { color: var(--rarity-epic); }
.eq-item-stats { margin-bottom: 10rpx; }
.eq-equip-btn { margin: auto 0 0; min-height: 72rpx; padding: 14rpx 10rpx; color: var(--accent); background: var(--accent-soft); border: 1px solid var(--line); border-radius: 10rpx; font-size: 26rpx; line-height: 1.4; }
.eq-equip-btn[disabled] { color: var(--muted); background: var(--surface-raised); }
.eq-set-note { margin-bottom: 20rpx; }
.eq-set { padding: 20rpx; margin-bottom: 14rpx; border: 1px solid var(--line); background-color: var(--surface-soft); border-radius: 14rpx; }
.eq-set-title { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; font-size: 30rpx; font-weight: 800; color: var(--text); margin-bottom: 14rpx; }
.eq-set-bonus { display: block; font-size: 26rpx; line-height: 1.7; color: var(--muted); margin: 8rpx 0; }
.eq-set-active { color: var(--hp); }
.eq-bottom-space { height: 36rpx; }
@media (max-width: 360px) { .eq-inventory { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .eq-notice, .eq-slot { animation: none; } }
.eq-economy { display: flex; flex-wrap: wrap; gap: 10rpx 18rpx; }
.eq-stats [role='button'], .eq-economy [role='button'] { cursor: pointer; }
</style>
