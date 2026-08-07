<script setup lang="ts">
import { useGameStore } from '../../store/gameStore'

const store = useGameStore()
</script>

<template>
  <view class="screen gameover-screen">
    <text class="gameover-title">冒险结束</text>
    <view class="gameover-stats">
      <text class="gameover-stat">持有金币: {{ store.player.gold }}</text>
      <text class="gameover-stat">获得灵魂碎片: {{ Math.floor(store.player.gold * 0.1) + 5 }}</text>
      <text class="gameover-stat">总计碎片: {{ store.meta.totalGold }}</text>
    </view>
    <view class="gameover-buttons">
      <button class="gameover-btn" @click="store.BACK_TO_TITLE()">返回主菜单</button>
      <button class="gameover-btn gameover-btn-secondary" @click="store.GO_TO_META_SHOP()">永久升级</button>
    </view>
  </view>
</template>

<style lang="scss">
.gameover-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a1a2e, #1a0a0a); }
.gameover-title { font-size: 36px; font-weight: bold; color: #e74c3c; margin-bottom: 24px; animation: gameover-shake 0.6s ease-out; }
.gameover-stats { display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; animation: title-fade 0.5s 0.3s both; }
.gameover-stat { font-size: 16px; color: #ccc; text-align: center; }
.gameover-buttons { display: flex; flex-direction: column; gap: 12px; width: 220px; }
.gameover-btn { width: 100%; background: #f1c40f; color: #1a1a2e; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; padding: 12px 0; }
.gameover-btn-secondary { background: transparent; color: #f1c40f; border: 2px solid #f1c40f; }
</style>
