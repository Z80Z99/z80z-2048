<script setup lang="ts">
import { computed } from 'vue'
import type { Cell } from '../types'
import { tileColors } from '../utils/boardEffects'
import type { MergeImpact } from '../utils/boardEffects'

const props = withDefaults(defineProps<{ cell: Cell; reducedMotion?: boolean; presentation?: boolean; impact?: MergeImpact }>(), {
  reducedMotion: false, presentation: false,
})
const palette = computed(() => {
  const { face, ink } = tileColors(props.cell.value)
  return { '--tile-face': face, '--tile-ink': ink }
})
const activeImpact = computed(() => !props.reducedMotion && !props.presentation ? props.impact : undefined)
const fontSize = computed(() => {
  const digits = String(props.cell.value).length
  return `${digits <= 2 ? 56 : digits === 3 ? 46 : digits === 4 ? 38 : digits === 5 ? 32 : digits <= 7 ? 26 : digits <= 10 ? 21 : 16}rpx`
})
</script>

<template>
  <view class="tile" :class="{ 'tile-new': cell.isNew && !cell.isMerged && !presentation && !reducedMotion, 'tile-source': presentation && !reducedMotion, 'tile-reduced': reducedMotion, 'tile-super': cell.value >= 4096 }"
    :style="palette" :role="presentation ? 'presentation' : 'gridcell'" :aria-hidden="presentation ? 'true' : undefined" :aria-label="presentation ? undefined : `数字 ${cell.value}`">
    <view class="tile-inner" :class="activeImpact ? `tile-impact-tier-${activeImpact.tier}` : undefined">
      <view class="tile-edge" aria-hidden="true" />
      <view v-for="decoration in activeImpact?.decorations ?? []" :key="decoration.key"
        class="tile-impact-bit" :class="[`tile-impact-${decoration.kind}`, `tile-impact-${decoration.kind}-${decoration.index}`]" aria-hidden="true" />
      <text class="tile-text" :style="{ fontSize }">{{ cell.value }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.tile { width: 100%; height: 100%; }
.tile-inner { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; border: 1px solid rgba(255, 244, 218, 0.18); border-radius: 12rpx; background: var(--tile-face, var(--tile-stone)); color: var(--tile-ink, var(--tile-text)); box-shadow: inset 0 3rpx 0 rgba(255, 255, 255, 0.1), 0 3rpx 5rpx rgba(0, 0, 0, 0.14); }
.tile-edge { position: absolute; inset: 5rpx; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8rpx; pointer-events: none; }
.tile-text { position: relative; z-index: 3; font-weight: 900; line-height: 1; letter-spacing: -1rpx; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tile-super .tile-inner { border: 2rpx solid #d5b466; }
.tile-new .tile-inner { animation: zbfx-tile-appear 170ms ease-out both; }
.tile-source .tile-inner { animation: zbfx-source 150ms ease-out both; }
.tile-inner.tile-impact-tier-small { animation: zbfx-tile-impact-small 280ms ease-out both; }
.tile-inner.tile-impact-tier-ring { animation: zbfx-tile-impact-ring 280ms ease-out both; }
.tile-inner.tile-impact-tier-chips { animation: zbfx-tile-impact-rebound 280ms ease-out both; }
.tile-inner.tile-impact-tier-strong { animation: zbfx-tile-impact-strong 280ms ease-out both; }
.tile-impact-bit { position: absolute; z-index: 1; pointer-events: none; opacity: 0; }
.tile-impact-flash { inset: 12%; border-radius: 50%; background: radial-gradient(ellipse, rgba(255, 252, 224, 0.9), rgba(255, 224, 148, 0.35) 48%, transparent 72%); animation: zbfx-tile-center-flash 170ms ease-out both; }
.tile-impact-ring { inset: -4rpx; border: 3rpx solid var(--accent); border-radius: 16rpx; animation: zbfx-tile-shockwave 245ms 12ms ease-out both; }
.tile-impact-ring-1 { animation: zbfx-tile-shockwave-wide 235ms 45ms ease-out both; border-width: 2rpx !important; }
.tile-impact-tier-strong > .tile-impact-ring { border-width: 4rpx; animation-duration: 260ms; }
.tile-impact-tier-strong > .tile-impact-flash { animation-duration: 195ms; }
.tile-impact-streak { width: 20rpx; height: 4rpx; border-radius: 4rpx; background: #ffe3a2; transform-origin: center; animation: zbfx-tile-radiant 175ms 18ms ease-out both; }
.tile-impact-streak-0 { left: 50%; top: -4rpx; --zbfx-streak-start: translate(-50%, 0) rotate(-90deg) scaleX(0.4); --zbfx-streak-end: translate(-50%, -17rpx) rotate(-90deg) scaleX(1.05); }
.tile-impact-streak-1 { right: -9rpx; top: 50%; --zbfx-streak-start: translate(0, -50%) scaleX(0.4); --zbfx-streak-end: translate(17rpx, -50%) scaleX(1.05); animation-delay: 26ms; }
.tile-impact-streak-2 { left: 50%; bottom: -4rpx; --zbfx-streak-start: translate(-50%, 0) rotate(90deg) scaleX(0.4); --zbfx-streak-end: translate(-50%, 17rpx) rotate(90deg) scaleX(1.05); animation-delay: 22ms; }
.tile-impact-streak-3 { left: -9rpx; top: 50%; --zbfx-streak-start: translate(0, -50%) rotate(180deg) scaleX(0.4); --zbfx-streak-end: translate(-17rpx, -50%) rotate(180deg) scaleX(1.05); animation-delay: 30ms; }
.tile-impact-chip { width: 10rpx; height: 8rpx; border: 1px solid rgba(255, 233, 183, 0.75); border-radius: 2rpx; background: var(--tile-face); animation: zbfx-tile-chip 215ms 38ms ease-out both; }
.tile-impact-chip-0 { left: 7%; top: 8%; --zbfx-chip-mid: translate(-13rpx, -21rpx) rotate(-32deg); --zbfx-chip-end: translate(-20rpx, -9rpx) rotate(-72deg) scale(0.6); }
.tile-impact-chip-1 { right: 7%; top: 12%; --zbfx-chip-mid: translate(16rpx, -17rpx) rotate(44deg); --zbfx-chip-end: translate(24rpx, 2rpx) rotate(94deg) scale(0.55); animation-duration: 225ms; animation-delay: 48ms; }
.tile-reduced .tile-inner { animation: none; }
.tile-reduced .tile-impact-bit { display: none; animation: none; }
@keyframes zbfx-source {
  0%, 60% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.88); opacity: 0.6; }
}
@keyframes zbfx-tile-appear {
  0% { transform: scale(0.78); }
  65% { transform: scale(1.04); }
  100% { transform: scale(1); }
}
@keyframes zbfx-tile-impact-small {
  0% { transform: scale(0.94, 0.89); }
  24% { transform: scale(1.09, 1.06); }
  55% { transform: scale(0.98); }
  100% { transform: scale(1); }
}
@keyframes zbfx-tile-impact-ring {
  0% { transform: scale(0.95, 0.86); }
  24% { transform: scale(1.13, 1.1); }
  58% { transform: scale(0.97, 1.01); }
  100% { transform: scale(1); }
}
@keyframes zbfx-tile-impact-rebound {
  0% { transform: scale(0.97, 0.82); }
  24% { transform: scale(1.17, 1.13); }
  52% { transform: scale(0.95, 1.03); }
  76% { transform: scale(1.04, 0.99); }
  100% { transform: scale(1); }
}
@keyframes zbfx-tile-impact-strong {
  0% { transform: scale(1.02, 0.76); }
  23% { transform: scale(1.22, 1.17); }
  50% { transform: scale(0.93, 1.06); }
  75% { transform: scale(1.06, 0.98); }
  100% { transform: scale(1); }
}
@keyframes zbfx-tile-center-flash {
  0% { transform: scale(0.45); opacity: 0.7; }
  30% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(1.22); opacity: 0; }
}
@keyframes zbfx-tile-shockwave {
  0% { transform: scale(0.83); opacity: 0.9; }
  30% { opacity: 0.6; }
  100% { transform: scale(1.38); opacity: 0; }
}
@keyframes zbfx-tile-shockwave-wide {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(1.55); opacity: 0; }
}
@keyframes zbfx-tile-radiant {
  0% { transform: var(--zbfx-streak-start); opacity: 0; }
  23% { opacity: 0.95; }
  100% { transform: var(--zbfx-streak-end); opacity: 0; }
}
@keyframes zbfx-tile-chip {
  0% { transform: translate(0, 0) rotate(0) scale(0.7); opacity: 0; }
  22% { opacity: 0.95; }
  50% { transform: var(--zbfx-chip-mid); opacity: 0.9; }
  100% { transform: var(--zbfx-chip-end); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .tile-inner { animation: none !important; }
  .tile-impact-bit { display: none; animation: none !important; }
}
</style>
