<script setup lang="ts">
import { useGameStore } from '../../store/gameStore'

const store = useGameStore()
</script>

<template>
  <view class="screen boss-choice-screen">
    <text class="boss-choice-title">BOSS 击败!</text>
    <text class="boss-choice-stage">第 {{ store.stage }} 阶段 通过</text>
    <view class="boss-choice-stats">
      <view class="boss-choice-stat">
        <text class="boss-choice-stat-label">HP</text>
        <text class="boss-choice-stat-val">{{ store.player.hp }}/{{ store.player.maxHp }}</text>
      </view>
      <view class="boss-choice-stat">
        <text class="boss-choice-stat-label">金币</text>
        <text class="boss-choice-stat-val boss-choice-gold">{{ store.player.gold }}</text>
      </view>
      <view class="boss-choice-stat">
        <text class="boss-choice-stat-label">等级</text>
        <text class="boss-choice-stat-val boss-choice-lv">Lv.{{ store.player.level }}</text>
      </view>
    </view>
    <text class="boss-choice-hint">继续攀登：敌人更强，奖励更丰厚\n结算离开：保留灵魂碎片</text>
    <view class="boss-choice-buttons">
      <button class="boss-btn boss-btn-continue" @click="store.BOSS_DEFEATED('continue')">继续攀登 ↑</button>
      <button class="boss-btn boss-btn-end" @click="store.BOSS_DEFEATED('end')">结算离开</button>
    </view>
  </view>
</template>

<style lang="scss">
.boss-choice-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #2e1a1a, #1a1a2e); }
.boss-choice-title { font-size: 36px; font-weight: bold; color: #f1c40f; margin-bottom: 8px; animation: boss-victory 0.6s ease-out; }
.boss-choice-stage { font-size: 18px; color: #888; margin-bottom: 24px; animation: title-fade 0.5s 0.2s ease-out both; }
.boss-choice-stats { display: flex; gap: 20px; margin-bottom: 24px; animation: title-fade 0.5s 0.3s ease-out both; }
.boss-choice-stat { text-align: center; } .boss-choice-stat-label { font-size: 14px; color: #888; display: block; } .boss-choice-stat-val { font-size: 22px; font-weight: bold; color: #ccc; }
.boss-choice-gold { color: #f1c40f; } .boss-choice-lv { color: #9b59b6; }
.boss-choice-hint { font-size: 14px; color: #888; text-align: center; margin-bottom: 24px; white-space: pre-line; }
.boss-choice-buttons { display: flex; flex-direction: column; gap: 12px; width: 220px; }
.boss-btn { width: 100%; border: none; border-radius: 8px; font-size: 18px; font-weight: bold; padding: 12px 0; }
.boss-btn-continue { background: #e74c3c; color: #fff; } .boss-btn-end { background: transparent; color: #888; border: 2px solid #555; }
</style>
