<script setup lang="ts">
import type { Cell } from '../types'
import { computed } from 'vue'

const props = defineProps<{ cell: Cell }>()

const isHigh = computed(() => props.cell.value >= 128)
const isVeryHigh = computed(() => props.cell.value >= 512)
const isSuper = computed(() => props.cell.value >= 1024)
</script>

<template>
  <view v-if="cell.value === 0" class="tile tile-empty" />
  <view v-else
    class="tile"
    :class="[
      `tile-${cell.value}`,
      { 'tile-new': cell.isNew, 'tile-merged': cell.isMerged, 'tile-pulse': isHigh, 'tile-radiant': isVeryHigh, 'tile-super': isSuper }
    ]"
  >
    <view class="tile-inner">
      <view class="tile-shine" />
      <text class="tile-text">{{ cell.value }}</text>
      <view v-if="cell.isMerged" class="tile-spark" />
    </view>
  </view>
</template>

<style lang="scss">
.tile { width: 100%; height: 100%; perspective: 400rpx; }
.tile-inner {
  position: relative; width: 100%; height: 100%; border-radius: 12rpx;
  display: flex; align-items: center; justify-content: center;
  box-sizing: border-box; overflow: hidden;
}
.tile-text { font-size: 48rpx; font-weight: bold; color: #776e65; position: relative; z-index: 2; text-shadow: 0 1px 2px rgba(0,0,0,0.1); }

/* Colors */
.tile-2 .tile-inner { background: #eee4da; }
.tile-4 .tile-inner { background: #ede0c8; }
.tile-8 .tile-inner { background: #f2b179; }
.tile-16 .tile-inner { background: #f59563; }
.tile-32 .tile-inner { background: #f67c5f; }
.tile-64 .tile-inner { background: #f65e3b; }
.tile-128 .tile-inner { background: #edcf72; }
.tile-256 .tile-inner { background: #edcc61; }
.tile-512 .tile-inner { background: #edc850; }
.tile-1024 .tile-inner { background: #edc53f; }
.tile-2048 .tile-inner { background: #edc22e; }

.tile-8 .tile-text, .tile-16 .tile-text, .tile-32 .tile-text, .tile-64 .tile-text,
.tile-128 .tile-text, .tile-256 .tile-text, .tile-512 .tile-text,
.tile-1024 .tile-text, .tile-2048 .tile-text { color: #f9f6f2; }

.tile-128 .tile-text, .tile-256 .tile-text, .tile-512 .tile-text { font-size: 40rpx; }
.tile-1024 .tile-text, .tile-2048 .tile-text { font-size: 32rpx; }

/* Glow levels */
.tile-128 .tile-inner, .tile-256 .tile-inner { box-shadow: 0 0 24rpx rgba(243,215,116,0.6), inset 0 0 16rpx rgba(255,255,255,0.15); }
.tile-512 .tile-inner, .tile-1024 .tile-inner { box-shadow: 0 0 32rpx rgba(243,215,116,0.75), inset 0 0 20rpx rgba(255,255,255,0.2); }
.tile-2048 .tile-inner { box-shadow: 0 0 40rpx rgba(243,215,116,0.9), 0 0 80rpx rgba(243,215,116,0.4), inset 0 0 24rpx rgba(255,255,255,0.25); }

/* Shine stripe */
.tile-shine { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1; pointer-events: none;
  background: linear-gradient(135deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0.00) 60%, rgba(255,255,255,0.15) 100%);
  border-radius: 12rpx; }

/* Merge spark burst */
.tile-spark {
  position: absolute; inset: -8rpx; border-radius: 16rpx; z-index: 0; pointer-events: none;
  background: radial-gradient(circle, rgba(255,255,200,0.8) 0%, rgba(255,255,200,0) 70%);
  animation: spark-burst 0.4s ease-out forwards;
}
@keyframes spark-burst {
  0% { transform: scale(0.5); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
}

/* New tile bounce */
.tile-new .tile-inner { animation: bounce-in 0.3s cubic-bezier(0.18,0.89,0.32,1.28); }
@keyframes bounce-in {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  80% { transform: scale(0.95); }
  100% { transform: scale(1); opacity: 1; }
}

/* Merge pop */
.tile-merged .tile-inner { animation: merge-pop 0.35s ease-out; }
.tile-merged .tile-text { animation: merge-text 0.35s ease-out; }
@keyframes merge-pop {
  0% { transform: scale(1); box-shadow: 0 0 0 rgba(255,255,255,0); }
  30% { transform: scale(1.25); box-shadow: 0 0 24px rgba(255,255,200,0.9); }
  70% { transform: scale(0.95); box-shadow: 0 0 8px rgba(255,255,200,0.3); }
  100% { transform: scale(1); box-shadow: 0 0 0 rgba(255,255,255,0); }
}
@keyframes merge-text {
  0%, 100% { transform: scale(1); }
  30% { transform: scale(1.3); color: #fff; }
}

/* High value pulse */
.tile-pulse .tile-inner { animation: pulse-glow 2s ease-in-out infinite; }
@keyframes pulse-glow {
  0% { box-shadow: 0 0 8px rgba(243,215,116,0.4), inset 0 0 4px rgba(255,255,255,0.1); }
  50% { box-shadow: 0 0 20px rgba(243,215,116,0.8), inset 0 0 12px rgba(255,255,255,0.25); }
  100% { box-shadow: 0 0 8px rgba(243,215,116,0.4), inset 0 0 4px rgba(255,255,255,0.1); }
}

/* 512+ radiant shimmer */
.tile-radiant .tile-shine {
  background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 30%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.2) 70%, rgba(255,255,255,0.4) 100%);
  animation: shimmer 2s ease-in-out infinite;
}
@keyframes shimmer {
  0%, 100% { opacity: 0.5; transform: translateX(-10%) skewX(-15deg); }
  50% { opacity: 1; transform: translateX(10%) skewX(-15deg); }
}

/* 1024+ super rainbow edge */
.tile-super .tile-inner {
  border: 2rpx solid transparent;
  background-image: linear-gradient(#edc53f, #edc22e), linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcb77, #4d96ff, #ff6b6b);
  background-origin: border-box; background-clip: padding-box, border-box;
  animation: rainbow-spin 3s linear infinite;
}
@keyframes rainbow-spin {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}
</style>
