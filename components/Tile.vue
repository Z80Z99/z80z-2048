<script setup lang="ts">
import { computed } from 'vue'
import type { Cell } from '../types'

const props = withDefaults(defineProps<{ cell: Cell; reducedMotion?: boolean }>(), { reducedMotion: false })
const knownValues = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]
const palette = computed(() => {
  if (props.cell.value >= 16384) return 'tile-legend'
  if (props.cell.value >= 4096) return 'tile-super'
  return knownValues.includes(props.cell.value) ? `tile-${props.cell.value}` : 'tile-fallback'
})
const fontSize = computed(() => {
  const digits = String(props.cell.value).length
  return `${digits <= 2 ? 56 : digits === 3 ? 46 : digits === 4 ? 38 : digits === 5 ? 32 : digits <= 7 ? 26 : digits <= 10 ? 21 : 16}rpx`
})
</script>

<template>
  <view class="tile" :class="[palette, { 'tile-new': cell.isNew, 'tile-merged': cell.isMerged, 'tile-reduced': reducedMotion }]"
    role="gridcell" :aria-label="`数字 ${cell.value}`">
    <view class="tile-inner">
      <view class="tile-edge" />
      <text class="tile-text" :style="{ fontSize }">{{ cell.value }}</text>
      <view v-if="cell.isMerged" class="tile-spark" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.tile { width: 100%; height: 100%; }
.tile-inner { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; border: 1px solid rgba(255, 244, 218, 0.18); border-radius: 12rpx; background: var(--tile-face, var(--tile-stone)); color: var(--tile-ink, var(--tile-text)); box-shadow: inset 0 3rpx 0 rgba(255, 255, 255, 0.1), 0 3rpx 5rpx rgba(0, 0, 0, 0.14); }
.tile-edge { position: absolute; inset: 5rpx; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8rpx; pointer-events: none; }
.tile-text { position: relative; z-index: 2; font-weight: 800; line-height: 1; letter-spacing: -1rpx; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tile-2 { --tile-face: var(--tile-stone); }
.tile-4 { --tile-face: var(--tile-slate); }
.tile-8 { --tile-face: #776544; --tile-ink: #fff6e5; }
.tile-16 { --tile-face: #8a633c; --tile-ink: #fff6e5; }
.tile-32 { --tile-face: #975432; --tile-ink: #fff6e5; }
.tile-64 { --tile-face: #9f4436; --tile-ink: #fff6e5; }
.tile-128 { --tile-face: #b38a47; --tile-ink: #21180c; }
.tile-256 { --tile-face: #c3a052; --tile-ink: #21180c; }
.tile-512 { --tile-face: #d5b466; --tile-ink: #21180c; }
.tile-1024 { --tile-face: #e1c37f; --tile-ink: #21180c; }
.tile-2048 { --tile-face: #f0d795; --tile-ink: #21180c; }
.tile-super { --tile-face: #623c2c; --tile-ink: #ffe6a9; }
.tile-legend { --tile-face: #433248; --tile-ink: #ffe6a9; }
.tile-fallback { --tile-face: var(--tile-stone); --tile-ink: var(--tile-text); }
.tile-super .tile-inner, .tile-legend .tile-inner { border: 2rpx solid #d5b466; }
.tile-new .tile-inner { animation: tile-appear 170ms ease-out both; }
.tile-merged .tile-inner { z-index: 4; animation: tile-merge 220ms ease-out; }
.tile-spark { position: absolute; inset: -6rpx; border: 3rpx solid var(--accent); border-radius: 14rpx; pointer-events: none; opacity: 0; animation: tile-spark 260ms ease-out; }
.tile-reduced .tile-inner, .tile-reduced .tile-spark { animation: none; }
@media (prefers-reduced-motion: reduce) { .tile-inner, .tile-spark { animation: none !important; } }
</style>
