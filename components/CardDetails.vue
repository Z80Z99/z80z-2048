<script setup lang="ts">
import { computed } from 'vue'
import type { CardClass, CardEffect, ConsumableDef } from '../types'
import { cardClassHelp, durationText, summarizeCard } from '../utils/displayText'
import type { DisplayContext, SummaryLine } from '../utils/displayText'
import { CARD_CLASS_SYMBOLS } from '../utils/artwork'
const props = withDefaults(defineProps<{
  cardClass: CardClass
  effects: CardEffect[]
  kind?: 'persistent' | 'instant'
  duration?: ConsumableDef['duration']
  count?: number
  compact?: boolean
  expanded?: boolean
  context?: DisplayContext
  summaryLines?: SummaryLine[]
  /** 详细模式默认附带品质与叠加说明；弹窗空间紧张时可单独关闭。 */
  showHelp?: boolean
}>(), { compact: true, expanded: false, showHelp: true })
const detailed = computed(() => !props.compact || props.expanded)
const lines = computed(() => props.summaryLines ?? summarizeCard({ effects: props.effects }, detailed.value ? { ...props.context, count: props.count } : props.context))
const timing = computed(() => props.duration ? durationText(props.duration) : props.kind ? durationText(props.kind) : '')
</script>

<template>
  <view class="card-details card-tone" :class="[`card-${cardClass}`, { 'card-details-expanded': detailed }]">
    <view v-for="(line, index) in lines" :key="index" class="card-effect" :class="`card-effect-${line.polarity}`">
      <text v-if="cardClass === 'red' || line.polarity === 'negative'" class="card-effect-sign">{{ line.polarity === 'negative' ? '−' : '+' }}</text><text class="card-effect-text">{{ line.text }}</text>
    </view>
    <view v-if="timing || cardClass === 'purple' || cardClass === 'black' || (count ?? 0) > 0" class="card-details-meta">
      <text v-if="timing" class="card-timing">{{ timing }}</text>
      <text v-if="cardClass === 'purple'" class="card-restriction">可净化</text>
      <text v-if="cardClass === 'black'" class="card-restriction">本局不可解除</text>
      <text v-if="(count ?? 0) > 0" class="card-count">已持有 {{ count }} 层</text>
    </view>
    <template v-if="detailed && showHelp">
      <text class="card-class-help">{{ CARD_CLASS_SYMBOLS[cardClass] }} {{ cardClassHelp(cardClass) }}</text>
      <text v-if="kind === 'persistent'" class="card-help-note">可继续叠加；每次获得或移除一层后，效果随持有数量变化。</text>
    </template>
  </view>
</template>

<style scoped lang="scss">
.card-details { text-align: left; white-space: normal; }
.card-effect { display: flex; align-items: baseline; gap: 6rpx; padding: 2rpx 0; font-size: 24rpx; line-height: 1.45; }
.card-effect-sign { flex-shrink: 0; font-weight: 800; color: var(--hp); }
.card-effect-negative .card-effect-sign { color: var(--attack); }
.card-effect-text { color: var(--text); overflow-wrap: anywhere; }
.card-effect-negative .card-effect-text { color: var(--attack); }
.card-details-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4rpx 12rpx; margin-top: 6rpx; font-size: 21rpx; line-height: 1.4; color: var(--muted); }
.card-timing { padding: 2rpx 8rpx; border-radius: 4rpx; background: var(--surface-soft); }
.card-restriction { color: var(--card-label-color, var(--attack)); font-weight: 700; }
.card-black .card-restriction { color: var(--attack); }
.card-class-help, .card-help-note { display: block; color: var(--muted); font-size: 24rpx; line-height: 1.6; margin-top: 14rpx; }
.card-details-expanded .card-effect { padding: 6rpx 0; font-size: 26rpx; }
</style>
