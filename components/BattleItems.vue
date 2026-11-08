<script setup lang="ts">
import { computed, inject } from 'vue'
import { CONSUMABLE_POOL } from '../core/consumables'
import { useGameStore } from '../store/gameStore'
import { useFeedback } from '../composables/useFeedback'
import { summarizeConsumable } from '../utils/displayText'
import type { Ref } from 'vue'
import CardIcon from './CardIcon.vue'

const store = useGameStore()
const blocked = inject<Ref<boolean>>('gameInputBlocked')
const feedback = useFeedback()
const items = computed(() => CONSUMABLE_POOL.filter(def => !def.cleanse && (store.consumableCounts[def.id] ?? 0) > 0).map(def => ({
  def, count: store.consumableCounts[def.id], reason: store.consumableDisabledReason(def.id),
  lines: summarizeConsumable(def),
})))
const cleanseOnly = computed(() => !items.value.length && (store.consumableCounts.cleanse_potion ?? 0) > 0)
function use(id: string) {
  if (blocked?.value || store.consumableDisabledReason(id)) return
  const before = store.consumableCounts[id] ?? 0
  store.USE_CONSUMABLE(id)
  if ((store.consumableCounts[id] ?? 0) < before) feedback.show(`已使用${CONSUMABLE_POOL.find(def => def.id === id)?.name ?? '道具'}`)
}
</script>

<template>
  <view class="battle-items">
    <scroll-view v-if="items.length" class="battle-item-scroll" scroll-x>
      <view class="battle-item-row">
        <button role="button" v-for="item in items" :key="item.def.id" class="battle-item ui-press" :class="`card-${item.def.cardClass}`" :disabled="Boolean(item.reason) || blocked" :aria-label="`使用${item.def.name}，剩余${item.count}件，${item.lines.map(line => line.text).join('；')}${item.reason ? `，${item.reason}` : ''}`" @click="use(item.def.id)">
          <CardIcon :card-class="item.def.cardClass" :icon="item.def.icon" size="small" />
          <view class="battle-item-copy"><text class="battle-item-name">{{ item.def.name }} <text class="battle-item-count">×{{ item.count }}</text></text><text v-for="line in item.lines" :key="line.text" class="battle-item-effect" :class="{ 'battle-item-risk': line.polarity === 'negative' }">{{ line.polarity === 'negative' ? '代价：' : '' }}{{ line.text }}</text></view>
        </button>
      </view>
    </scroll-view>
    <text v-else class="battle-items-empty">{{ cleanseOnly ? '净化药剂需在战斗外使用' : '暂无战斗道具，可在商店购买' }}</text>
    <text v-if="feedback.text.value" :key="feedback.revision.value" class="battle-item-notice ui-feedback" role="status">{{ feedback.text.value }}</text>
  </view>
</template>

<style scoped lang="scss">
.battle-items { position: relative; width: 100%; max-width: 660rpx; margin: 8rpx auto 0; }
.battle-item-scroll { width: 100%; white-space: nowrap; }
.battle-item-row { display: flex; gap: 10rpx; padding: 4rpx 0; }
.battle-item { display: flex; align-items: center; gap: 10rpx; min-width: 210rpx; max-width: 370rpx; flex-shrink: 0; margin: 0; padding: 10rpx; border: 1px solid var(--line); border-left: 3rpx solid var(--card-color); border-radius: 10rpx; background: var(--surface); color: var(--text); text-align: left; line-height: 1.3; }
.battle-item::after { border: none; }
.battle-item-copy { white-space: normal; min-width: 0; }
.battle-item-name { display: block; font-size: 23rpx; font-weight: 700; }
.battle-item-count { color: var(--gold); font-weight: 500; }
.battle-item-effect { display: block; font-size: 20rpx; color: var(--muted); margin-top: 3rpx; line-height: 1.35; }
.battle-item-risk { color: var(--attack); }
.battle-items-empty { display: block; font-size: 21rpx; color: var(--dim); text-align: center; line-height: 1.4; }
.battle-item-notice { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); width: max-content; max-width: 100%; box-sizing: border-box; padding: 7rpx 16rpx; border: 1px solid var(--line); border-radius: 9rpx; background: var(--surface); color: var(--hp); font-size: 23rpx; line-height: 1.4; pointer-events: none; }
</style>
