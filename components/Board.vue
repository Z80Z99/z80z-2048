<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../store/gameStore'
import { useSwipe } from '../composables/useSwipe'
import Tile from './Tile.vue'

const store = useGameStore()
const grid = computed(() => store.battle?.grid ?? [])
const { onTouchStart, onTouchEnd } = useSwipe((dir) => { store.SLIDE(dir) })

const maxVal = computed(() => {
  let m = 0
  for (const row of grid.value) for (const cell of row) if (cell.value > m) m = cell.value
  return m
})
</script>
<template>
  <view class="board" :class="{ 'board-glow': maxVal >= 128, 'board-radiant': maxVal >= 512, 'board-super': maxVal >= 1024 }"
    @touchstart="onTouchStart" @touchend="onTouchEnd">
    <view v-for="i in 16" :key="i" class="cell-box">
      <template v-if="grid[Math.floor((i-1)/4)]?.[(i-1)%4]?.value > 0">
        <Tile :cell="grid[Math.floor((i-1)/4)][(i-1)%4]" />
      </template>
      <view v-else class="cell-empty" />
    </view>
  </view>
</template>
<style lang="scss">
.board { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); gap: 16rpx; width: 640rpx; height: 640rpx; padding: 16rpx; background: #bbada0; border-radius: 16rpx; box-sizing: border-box; margin: 0 auto; transition: box-shadow 0.5s; }
.board-glow { box-shadow: 0 0 30rpx rgba(241,196,15,0.25); }
.board-radiant { box-shadow: 0 0 50rpx rgba(241,196,15,0.4), 0 0 100rpx rgba(241,196,15,0.15); }
.board-super { box-shadow: 0 0 70rpx rgba(241,196,15,0.5), 0 0 140rpx rgba(241,196,15,0.2), 0 0 200rpx rgba(255,100,100,0.1); animation: board-pulse 2s ease-in-out infinite; }
@keyframes board-pulse { 0%,100% { box-shadow: 0 0 50rpx rgba(241,196,15,0.4), 0 0 100rpx rgba(241,196,15,0.15); } 50% { box-shadow: 0 0 80rpx rgba(241,196,15,0.6), 0 0 150rpx rgba(255,100,100,0.25); } }
.cell-box { border-radius: 12rpx; overflow: hidden; }
.cell-empty { width: 100%; height: 100%; background: rgba(238, 228, 218, 0.35); border-radius: 12rpx; transition: background 0.3s; }
.board-glow .cell-empty { background: rgba(238, 228, 218, 0.25); }
</style>
