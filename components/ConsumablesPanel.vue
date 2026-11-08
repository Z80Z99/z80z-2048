<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useGameStore } from '../store/gameStore'
import { CONSUMABLE_POOL } from '../core/consumables'
import { canRemoveCard } from '../core/upgrade'
import { summarizeConsumable } from '../utils/displayText'
import { useFeedback } from '../composables/useFeedback'
import CardIcon from './CardIcon.vue'
import CardDetails from './CardDetails.vue'
import ExpandPanel from './ExpandPanel.vue'
const emit = defineEmits<{ close: [] }>()
const store = useGameStore()
const reduced = inject('motionReduced', ref(false))
const feedback = useFeedback()
const selectedPurple = ref<string | null>(null)
const showEmpty = ref(false)
const purpleCards = computed(() => store.upgrades.filter(upgrade => upgrade.def.cardClass === 'purple' && upgrade.count > 0 && canRemoveCard(upgrade.def, 'cleanse')))
const targetId = computed(() => purpleCards.value.some(upgrade => upgrade.def.id === selectedPurple.value) ? selectedPurple.value : null)
const items = computed(() => CONSUMABLE_POOL.map(def => {
  const count = store.consumableCounts[def.id] ?? 0
  const reason = store.consumableDisabledReason(def.id)
  return { def, count, reason: reason ?? (def.cleanse && !targetId.value ? purpleCards.value.length ? '请先选择一张紫卡' : '没有可净化的紫卡；黑卡本局不可解除' : null) }
}))
const stocked = computed(() => items.value.filter(item => item.count > 0))
const empty = computed(() => items.value.filter(item => item.count <= 0))
const totalCount = computed(() => Object.values(store.consumableCounts).reduce((sum, count) => sum + count, 0))
function use(id: string, cleanse: boolean) {
  const item = items.value.find(item => item.def.id === id)
  if (!item || item.reason || item.count <= 0) return
  const before = store.consumableCounts[id] ?? 0
  const target = targetId.value
  const targetName = purpleCards.value.find(upgrade => upgrade.def.id === target)?.def.name
  store.USE_CONSUMABLE(id, cleanse ? target ?? undefined : undefined)
  if ((store.consumableCounts[id] ?? 0) < before) feedback.show(cleanse ? `已净化「${targetName}」一层` : `已使用${item.def.name}`)
}
</script>

<template>
  <view class="ui-overlay ui-sheet-overlay consumables-overlay" @click="emit('close')">
    <view class="ui-sheet" role="dialog" aria-modal="true" aria-label="道具背包" @click.stop>
      <view class="ui-sheet-header"><view><text class="ui-kicker">携带库存 · {{ totalCount }} 件</text><text class="ui-sheet-title">道具背包</text></view><button role="button" class="ui-close ui-press" @click="emit('close')">关闭</button></view>
      <text class="ui-note consumables-note">药剂和卷轴在战斗操作时使用；净化药剂在路线、商店或营地使用。购买后不会自动使用。</text>
      <text v-if="feedback.text.value" :key="feedback.revision.value" class="consumables-notice ui-feedback" role="status">{{ feedback.text.value }}</text>
      <scroll-view class="ui-scroll" scroll-y>
        <view v-if="purpleCards.length" class="cleanse-targets"><text class="consumables-heading">净化目标 · 每次移除一层</text><button role="button" v-for="upgrade in purpleCards" :key="upgrade.def.id" class="cleanse-target ui-press" :aria-pressed="targetId === upgrade.def.id" :class="{ 'cleanse-target-selected': targetId === upgrade.def.id }" @click="selectedPurple = upgrade.def.id"><CardIcon :card-class="upgrade.def.cardClass" :icon="upgrade.def.icon" size="small" /><view><text>{{ targetId === upgrade.def.id ? '已选' : '选择' }} · {{ upgrade.def.name }} ×{{ upgrade.count }}</text><CardDetails :card-class="upgrade.def.cardClass" :effects="upgrade.def.effects" /></view></button></view>
        <text v-else class="ui-note consumables-note">没有紫卡可净化。黑卡本局不可解除。</text>
        <text v-if="!stocked.length" class="ui-note consumables-note">背包暂无道具，可在商店或奇遇中购买。</text>
        <view v-for="item in stocked" :key="item.def.id" class="consumable-card card-tone card-frame" :class="`card-${item.def.cardClass}`">
          <view class="consumable-heading"><CardIcon :card-class="item.def.cardClass" :icon="item.def.icon" size="small" /><view class="consumable-identity"><text class="consumables-heading">{{ item.def.name }}</text></view><text class="consumable-count">×{{ item.count }}</text></view>
          <CardDetails :card-class="item.def.cardClass" :effects="item.def.effects" :summary-lines="summarizeConsumable(item.def)" :duration="item.def.duration" />
          <text v-if="item.reason" class="consumable-reason">{{ item.reason }}</text>
          <button role="button" class="ui-btn ui-btn-secondary consumable-use ui-press" :disabled="Boolean(item.reason)" :aria-label="`使用${item.def.name}，库存${item.count}件${item.reason ? `，${item.reason}` : ''}`" @click="use(item.def.id, Boolean(item.def.cleanse))">{{ item.reason ? '暂不可使用' : item.def.cleanse ? '净化已选紫卡一层' : '使用一件' }}</button>
        </view>
        <button v-if="empty.length" role="button" class="empty-toggle ui-press" :aria-expanded="showEmpty" @click="showEmpty = !showEmpty">{{ showEmpty ? '收起' : '查看' }}未持有道具 · {{ empty.length }} 种</button>
        <ExpandPanel :open="showEmpty" :revision="empty.length" :reduced="reduced">
          <view v-for="item in empty" :key="item.def.id" class="consumable-empty"><text class="consumables-heading">{{ item.def.name }} · 未持有</text><CardDetails :card-class="item.def.cardClass" :effects="item.def.effects" :summary-lines="summarizeConsumable(item.def)" :duration="item.def.duration" /></view>
        </ExpandPanel>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.consumables-overlay { z-index: 120; }
.consumables-note { margin-bottom: 16rpx; }
.consumables-heading { display: block; font-size: 28rpx; font-weight: 800; color: var(--text); line-height: 1.5; }
.consumable-card { border: 1px solid var(--line); border-left: 4rpx solid var(--card-color); border-radius: 14rpx; background: var(--surface-soft); padding: 16rpx; margin-bottom: 12rpx; display: flex; flex-direction: column; gap: 8rpx; }
.consumable-heading { display: flex; align-items: center; gap: 12rpx; }
.consumable-identity { flex: 1; min-width: 0; }
.consumable-count { color: var(--gold); font-size: 26rpx; font-weight: 700; }
.consumable-reason { color: var(--attack); font-size: 24rpx; line-height: 1.5; }
.consumable-use { min-height: 72rpx; padding: 12rpx; width: 100%; }
.cleanse-targets { margin-bottom: 18rpx; }
.cleanse-target { display: flex; gap: 12rpx; align-items: flex-start; width: 100%; margin: 8rpx 0 0; padding: 12rpx; border: 1px solid var(--line); border-radius: 12rpx; background: var(--surface-soft); color: var(--text); text-align: left; font-size: 26rpx; line-height: 1.5; }
.cleanse-target::after, .empty-toggle::after { border: none; }
.cleanse-target-selected { border: 2px solid var(--card-purple); }
.empty-toggle { width: 100%; margin: 0; padding: 16rpx 0; color: var(--muted); background: transparent; text-align: left; font-size: 24rpx; }
.consumable-empty { border-top: 1px solid var(--line); padding: 14rpx 0; }
.consumables-notice { display: block; color: var(--hp); font-size: 26rpx; padding: 10rpx 0; }
@media (prefers-reduced-motion: reduce) { .consumables-notice { animation: none; } }
</style>
