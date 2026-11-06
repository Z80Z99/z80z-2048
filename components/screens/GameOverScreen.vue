<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../store/gameStore'

const store = useGameStore()
const victory = computed(() => store.runOutcome === 'victory')
const heading = computed(() => victory.value ? '凯旋而归' : store.runOutcome === 'defeat' ? '旅途暂歇' : '冒险结束')
</script>

<template>
  <view class="screen gameover-screen"><view class="gameover-content">
    <text class="ui-kicker">{{ victory ? '胜利结算 / VICTORY' : store.runOutcome === 'defeat' ? '战败结算 / DEFEAT' : '旅程结算' }}</text>
    <view class="gameover-seal" :class="{ 'gameover-seal-defeat': !victory }"><text>{{ victory ? '◇' : '—' }}</text></view>
    <text class="ui-title gameover-title">{{ heading }}</text>
    <text class="ui-body gameover-copy">{{ victory ? '你击败了守关首领，带着战利品平安离开。' : '这次冒险已经结束，积累的传承会陪你再次出发。' }}</text>
    <view class="gameover-receipt ui-card">
      <view class="gameover-shards"><text class="gameover-label">本次获得灵魂碎片</text><text class="gameover-shard-value">+{{ store.runShards }}</text></view>
      <view class="gameover-stat"><text>到达阶段</text><text>S{{ store.stage }}</text></view>
      <view class="gameover-stat"><text>冒险等级</text><text>Lv.{{ store.effectivePlayer.level }}</text></view>
      <view class="gameover-stat"><text>结算金币</text><text class="stat-gold">{{ store.player.gold }}</text></view>
      <view class="gameover-stat"><text>累计灵魂碎片</text><text class="stat-xp">{{ store.meta.totalGold }}</text></view>
    </view>
    <view class="gameover-actions"><button role="button" class="ui-btn" @click="store.GO_TO_META_SHOP()">使用碎片，提升传承</button><button role="button" class="ui-btn ui-btn-secondary" @click="store.BACK_TO_TITLE()">返回主菜单</button></view>
  </view></view>
</template>

<style scoped lang="scss">
.gameover-screen { display: flex; align-items: center; justify-content: center; padding-bottom: calc(44rpx + var(--safe-bottom)); }
.gameover-content { width: 100%; max-width: 640rpx; text-align: center; padding: 30rpx 0; }
.gameover-seal { display: flex; align-items: center; justify-content: center; width: 132rpx; height: 142rpx; margin: 30rpx auto; border: 1px solid var(--accent); border-radius: 66rpx 66rpx 16rpx 16rpx; color: var(--accent); background: var(--accent-soft); font-size: 70rpx; }
.gameover-seal-defeat { color: var(--attack); border-color: var(--line); background: var(--attack-soft); }
.gameover-title { margin-bottom: 20rpx; }
.gameover-copy { margin-bottom: 30rpx; }
.gameover-receipt { padding: 26rpx; text-align: left; }
.gameover-shards { padding-bottom: 20rpx; margin-bottom: 12rpx; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 16rpx; }
.gameover-label { font-size: 28rpx; color: var(--text); }
.gameover-shard-value { font-size: 50rpx; color: var(--xp); font-weight: 800; }
.gameover-stat { display: flex; justify-content: space-between; gap: 16rpx; color: var(--muted); font-size: 28rpx; padding: 10rpx 0; }
.gameover-actions { display: flex; flex-direction: column; gap: 14rpx; margin-top: 26rpx; }
</style>
