<script setup lang="ts">
import { useGameStore } from '../../store/gameStore'
import { rarityText } from '../../core/upgrade'

const store = useGameStore()

const rarityColors: Record<string, string> = { common: '#aaa', rare: '#3498db', epic: '#e74c3c' }
</script>

<template>
  <view class="screen reward-screen">
    <template v-if="store.rewardReason === 'start'">
      <text class="reward-title">选择初始强化</text>
      <text class="reward-sub">从三个强化中选择一个开始冒险</text>
    </template>
    <template v-else>
      <text class="reward-title">LEVEL UP!{{ store.pendingLevels > 0 ? ` (${store.pendingLevels + 1}次可选)` : '' }}</text>
      <text class="reward-lv">Lv.{{ store.player.level }}</text>
      <view class="reward-xp-bar">
        <view class="reward-xp-fill" :style="{ width: `${Math.min(100, (store.player.xp / store.player.xpToNext) * 100)}%` }" />
      </view>
      <text class="reward-xp-text">{{ store.player.xp }}/{{ store.player.xpToNext }} XP</text>
      <text class="reward-sub">选择一个强化</text>
    </template>
    <view class="reward-choices">
      <view v-for="upgrade in store.rewardChoices" :key="upgrade.id" class="reward-card"
        :style="{ borderColor: rarityColors[upgrade.rarity] }" @click="store.PICK_UPGRADE(upgrade.id)">
        <text class="reward-card-rarity" :style="{ color: rarityColors[upgrade.rarity] }">{{ rarityText(upgrade.rarity) }}</text>
        <text class="reward-card-name">{{ upgrade.name }}</text>
        <text class="reward-card-desc">{{ upgrade.description }}</text>
      </view>
    </view>
    <button class="reward-skip" @click="store.SKIP_REWARD()">跳过(继续前进)</button>
  </view>
</template>

<style lang="scss">
.reward-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460); }
.reward-title { font-size: 36px; font-weight: bold; color: #f1c40f; margin-bottom: 4px; animation: boss-victory 0.5s ease-out; }
.reward-sub { font-size: 14px; color: #888; margin-bottom: 20px; animation: title-fade 0.4s 0.15s both; }
.reward-lv { font-size: 20px; color: #9b59b6; margin-bottom: 10px; }
.reward-xp-bar { width: 200px; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; margin-bottom: 4px; }
.reward-xp-fill { height: 100%; background: #9b59b6; border-radius: 4px; transition: width 0.3s; }
.reward-xp-text { font-size: 12px; color: #888; margin-bottom: 12px; }
.reward-choices { display: flex; gap: 12px; margin-bottom: 24px; }
.reward-card { width: 110px; padding: 14px 10px; border-radius: 10px; border: 2px solid; background: rgba(255,255,255,0.03); text-align: center; animation: card-pop 0.35s ease-out both; transition: all 0.2s; }
.reward-card:nth-child(1) { animation-delay: 0.1s; }
.reward-card:nth-child(2) { animation-delay: 0.2s; }
.reward-card:nth-child(3) { animation-delay: 0.3s; }
.reward-card:active { transform: scale(0.95); filter: brightness(1.3); }
.reward-card-rarity { font-size: 11px; font-weight: bold; display: block; margin-bottom: 6px; }
.reward-card-name { font-size: 15px; font-weight: bold; color: #ccc; display: block; margin-bottom: 4px; }
.reward-card-desc { font-size: 11px; color: #888; }
.reward-skip { background: transparent; color: #888; border: 1px solid #555; border-radius: 8px; font-size: 14px; padding: 8px 24px; margin-top: 12px; transition: all 0.2s; }
.reward-skip:active { border-color: #f1c40f; color: #f1c40f; }
</style>
