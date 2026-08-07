<script setup lang="ts">
import { computed } from 'vue'
import type { BattleResult } from '../types'
import { useGameStore } from '../store/gameStore'
const props = defineProps<{ result: BattleResult }>()
const store = useGameStore()
const overflow = computed(() => props.result.overflowDamage ?? 0)
</script>
<template>
  <view class="result-overlay">
    <view class="result-modal">
      <text class="result-title">{{ result.playerWon ? '战斗胜利!' : '战斗失败' }}</text>
      <view class="result-summary"><text class="result-summary-text">共经历 {{ result.totalRounds }} 个回合</text></view>
      <template v-if="result.playerWon">
        <view class="result-phase"><text class="result-phase-label">基础金币</text><text class="result-phase-val result-gold">+{{ result.goldEarned }}</text></view>
        <view class="result-divider" />
        <view class="result-phase"><text class="result-phase-label">获得经验</text><text class="result-phase-val result-xp">+{{ result.xpEarned ?? 0 }} XP</text></view>
        <template v-if="overflow > 0">
          <view class="result-divider" /><text class="result-overflow-title">溢出伤害: {{ overflow }}</text>
          <view class="result-overflow-choices">
            <view class="result-overflow-btn result-overflow-gold" @click="store.END_BATTLE('gold')"><text class="result-overflow-val">+{{ overflow }} 金币</text><text class="result-overflow-label">转为金币</text></view>
            <view class="result-overflow-btn result-overflow-xp" @click="store.END_BATTLE('xp')"><text class="result-overflow-val">+{{ Math.floor(overflow / 2) }} XP</text><text class="result-overflow-label">转为经验</text></view>
          </view>
        </template>
        <view v-if="overflow === 0" class="result-continue-btn" @click="store.END_BATTLE()"><text class="result-continue-text">{{ result.leveledUp ? '选择强化' : '继续前进' }}</text></view>
        <view class="result-xp-bar-wrap"><view class="result-xp-bar"><view class="result-xp-fill" :style="{ width: `${Math.min(100, (store.player.xp / store.player.xpToNext) * 100)}%` }" /></view><text class="result-xp-bar-text">Lv.{{ store.player.level }} · {{ store.player.xp }}/{{ store.player.xpToNext }}</text></view>
      </template>
      <view v-if="!result.playerWon" class="result-continue-btn" @click="store.END_BATTLE()"><text class="result-continue-text">返回</text></view>
    </view>
  </view>
</template>
<style lang="scss">
.result-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; animation: overlay-in 0.25s; }
@keyframes overlay-in { 0% { opacity: 0 } 100% { opacity: 1 } }
.result-modal { background: linear-gradient(180deg, #1a1a2e, #12122a); border: 1px solid rgba(255,255,255,0.08); border-radius: 20rpx; padding: 32rpx 28rpx; width: 300px; text-align: center; animation: card-pop 0.4s cubic-bezier(0.34,1.56,0.64,1); }
@keyframes card-pop { 0% { opacity: 0; transform: scale(0.8) translateY(30rpx); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
.result-title { font-size: 28px; font-weight: bold; color: #f1c40f; display: block; margin-bottom: 12px; }
.result-summary { margin-bottom: 16px; } .result-summary-text { font-size: 14px; color: #888; }
.result-phase { display: flex; justify-content: space-between; padding: 8px 0; } .result-phase-label { font-size: 15px; color: #888; } .result-phase-val { font-size: 16px; font-weight: bold; color: #ccc; }
.result-gold { color: #f39c12; } .result-xp { color: #9b59b6; }
.result-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 4px 0; }
.result-overflow-title { font-size: 16px; font-weight: bold; color: #e74c3c; display: block; margin: 12px 0 10px; }
.result-overflow-choices { display: flex; gap: 12px; margin-bottom: 16px; }
.result-overflow-btn { flex: 1; padding: 14rpx 8rpx; border-radius: 12rpx; text-align: center; }
.result-overflow-gold { background: rgba(241,196,15,0.1); border: 2px solid #f1c40f; } .result-overflow-gold .result-overflow-val { color: #f1c40f; }
.result-overflow-xp { background: rgba(155,89,182,0.1); border: 2px solid #9b59b6; } .result-overflow-xp .result-overflow-val { color: #9b59b6; }
.result-overflow-val { font-size: 20px; font-weight: bold; display: block; } .result-overflow-label { font-size: 12px; color: #888; margin-top: 2px; }
.result-continue-btn { background: #f1c40f; border-radius: 10rpx; padding: 14rpx; margin-top: 12px; } .result-continue-text { font-size: 16px; color: #1a1a2e; font-weight: bold; }
.result-xp-bar-wrap { margin-top: 16px; } .result-xp-bar { width: 100%; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
.result-xp-fill { height: 100%; background: #9b59b6; border-radius: 4px; transition: width 0.3s; } .result-xp-bar-text { font-size: 11px; color: #888; margin-top: 4px; }
</style>
