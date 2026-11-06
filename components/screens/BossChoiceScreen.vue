<script setup lang="ts">
import { useGameStore } from '../../store/gameStore'
const store = useGameStore()
</script>

<template>
  <view class="screen boss-choice-screen"><view class="boss-content">
    <text class="ui-kicker">守关首领已击败</text>
    <view class="boss-seal"><text>♜</text></view>
    <text class="ui-title boss-title">更深处，还是归途？</text>
    <text class="ui-body boss-subtitle">第 {{ store.stage }} 阶段已通过，这一刻由你决定。</text>
    <view class="boss-stats ui-card"><view><text class="boss-stat-label">生命</text><text class="boss-stat-value stat-hp">{{ store.effectivePlayer.hp }}/{{ store.effectivePlayer.maxHp }}</text></view><view><text class="boss-stat-label">金币</text><text class="boss-stat-value stat-gold">{{ store.player.gold }}</text></view><view><text class="boss-stat-label">等级</text><text class="boss-stat-value stat-xp">Lv.{{ store.effectivePlayer.level }}</text></view></view>
    <view class="boss-options"><button role="button" class="boss-option boss-option-next" @click="store.BOSS_DEFEATED('continue')"><view><text class="boss-option-title">继续攀登 · S{{ store.stage + 1 }}</text><text class="boss-option-note">{{ store.stage >= 3 ? '进入更深的无尽地牢，继续挑战成长中的敌人。' : '走向下一阶段，更强的敌人，更丰厚的战利品。' }}</text></view><text class="boss-option-arrow">↑</text></button><button role="button" class="boss-option" @click="store.BOSS_DEFEATED('end')"><view><text class="boss-option-title">胜利结算离开</text><text class="boss-option-note">结束本局冒险，领取本次灵魂碎片用于永久升级。</text></view><text class="boss-option-arrow">→</text></button></view>
  </view></view>
</template>

<style scoped lang="scss">
.boss-choice-screen { display: flex; align-items: center; justify-content: center; padding-bottom: calc(44rpx + var(--safe-bottom)); }
.boss-content { width: 100%; max-width: 680rpx; text-align: center; padding: 40rpx 0; }
.boss-seal { width: 142rpx; height: 156rpx; margin: 32rpx auto; border: 1px solid var(--accent); border-radius: 72rpx 72rpx 18rpx 18rpx; background: var(--accent-soft); display: flex; align-items: center; justify-content: center; color: var(--accent); font-size: 78rpx; }
.boss-title { margin: 12rpx 0 22rpx; font-size: 42rpx; }
.boss-subtitle { margin-bottom: 28rpx; }
.boss-stats { display: flex; justify-content: space-around; gap: 18rpx; padding: 24rpx 16rpx; margin-bottom: 30rpx; }
.boss-stat-label { display: block; font-size: 26rpx; color: var(--muted); }
.boss-stat-value { display: block; font-size: 30rpx; font-weight: 800; margin-top: 6rpx; }
.boss-options { display: flex; flex-direction: column; gap: 16rpx; }
.boss-option { display: flex; align-items: center; gap: 20rpx; padding: 26rpx; margin: 0; box-sizing: border-box; text-align: left; background: var(--surface); color: var(--text); border: 1px solid var(--line); border-radius: 16rpx; line-height: 1.6; }
.boss-option::after { border: none; }
.boss-option-next { border-color: var(--accent); background: var(--accent-soft); }
.boss-option-title { display: block; font-size: 30rpx; font-weight: 800; margin-bottom: 10rpx; }
.boss-option-note { display: block; color: var(--muted); font-size: 26rpx; white-space: normal; }
.boss-option-arrow { font-size: 40rpx; flex-shrink: 0; color: var(--accent); }
</style>
