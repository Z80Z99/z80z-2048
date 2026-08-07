<script setup lang="ts">
import { useGameStore } from '../../store/gameStore'

const store = useGameStore()
</script>

<template>
  <view class="screen rest-screen">
    <text class="rest-title">休息营地</text>
    <text class="rest-info">恢复了 {{ Math.floor(store.player.maxHp * 0.3) }} 点生命</text>
    <text class="rest-hp">当前 HP: {{ store.player.hp }}/{{ store.player.maxHp }}</text>
    <button class="rest-continue" @click="store.GO_TO_ROUTE()">继续前进</button>
  </view>
</template>

<style lang="scss">
.rest-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a2a1e, #16213e, #0f3020); }
.rest-title { font-size: 36px; font-weight: bold; color: #2ecc71; margin-bottom: 16px; animation: heal-pulse 1.5s ease-in-out infinite; }
.rest-info { font-size: 16px; color: #888; margin-bottom: 8px; animation: title-fade 0.5s 0.2s both; }
.rest-hp { font-size: 20px; color: #ccc; margin-bottom: 24px; animation: title-fade 0.5s 0.3s both; }
.rest-continue { background: #2ecc71; color: #fff; border: none; border-radius: 8px; font-size: 18px; font-weight: bold; padding: 12px 40px; transition: all 0.2s; animation: title-fade 0.5s 0.4s both; }
.rest-continue:active { transform: scale(0.95); filter: brightness(1.2); }
</style>
