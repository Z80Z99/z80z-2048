<script setup lang="ts">
import { useGameStore } from '../store/gameStore'
const store = useGameStore()
</script>
<template>
  <view class="evt-root">
    <!-- Event choices -->
    <view v-if="!store.eventResult" class="evt-card">
      <view class="evt-icon-wrap"><text class="evt-icon">{{ store.gameEvent?.icon || '?' }}</text></view>
      <text class="evt-title">{{ store.gameEvent?.title || '' }}</text>
      <text class="evt-desc">{{ store.gameEvent?.desc || '' }}</text>
      <view class="evt-choices">
        <view v-for="(c, i) in (store.gameEvent?.choices || [])" :key="i"
          class="evt-choice" @click="store.RESOLVE_EVENT(i)">
          <text class="evt-choice-label">{{ c.label }}</text>
          <text v-if="c.tooltip" class="evt-choice-tip">{{ c.tooltip }}</text>
        </view>
      </view>
    </view>

    <!-- Event result -->
    <view v-else class="evt-card">
      <view class="evt-icon-wrap evt-result-icon"><text class="evt-icon">{{ store.gameEvent?.icon || '?' }}</text></view>
      <text class="evt-title">「{{ store.eventResult.label }}」</text>
      <text class="evt-desc evt-result-desc">{{ store.eventResult.desc }}</text>
      <view class="evt-continue" @click="store.APPLY_EVENT()">
        <text class="evt-continue-txt">继续前进 →</text>
      </view>
    </view>
  </view>
</template>
<style lang="scss">
.evt-root { position: fixed; inset: 0; z-index: 75; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.7); animation: evt-in 0.3s; }
@keyframes evt-in { from { opacity: 0; } to { opacity: 1; } }
.evt-card { width: 620rpx; max-height: 80vh; background: linear-gradient(160deg, #1a1a30 0%, #0d0d1a 100%); border-radius: 20rpx; padding: 36rpx 28rpx 28rpx; border: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; align-items: center; box-shadow: 0 16rpx 48rpx rgba(0,0,0,0.6); }
.evt-icon-wrap { width: 72rpx; height: 72rpx; border-radius: 36rpx; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; margin-bottom: 16rpx; }
.evt-icon { font-size: 36rpx; }
.evt-title { font-size: 32rpx; font-weight: 800; color: #f1c40f; margin-bottom: 12rpx; text-align: center; }
.evt-desc { font-size: 22rpx; color: #aaa; text-align: center; line-height: 34rpx; margin-bottom: 28rpx; }
.evt-choices { width: 100%; display: flex; flex-direction: column; gap: 12rpx; }
.evt-choice { padding: 18rpx 22rpx; border-radius: 12rpx; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); display: flex; flex-direction: column; align-items: center; gap: 4rpx; transition: all 0.15s; }
.evt-choice:active { background: rgba(241,196,15,0.08); border-color: rgba(241,196,15,0.25); }
.evt-choice-label { font-size: 24rpx; font-weight: 700; color: #ddd; }
.evt-choice-tip { font-size: 18rpx; color: #888; }
.evt-result-icon { border: 2px solid rgba(241,196,15,0.3); box-shadow: 0 0 16rpx rgba(241,196,15,0.1); }
.evt-result-desc { font-size: 26rpx !important; color: #fff !important; font-weight: 600; }
.evt-continue { margin-top: 24rpx; padding: 16rpx 60rpx; border-radius: 40rpx; background: rgba(241,196,15,0.1); border: 1px solid rgba(241,196,15,0.25); transition: all 0.15s; }
.evt-continue:active { background: rgba(241,196,15,0.2); }
.evt-continue-txt { font-size: 24rpx; font-weight: 700; color: #f1c40f; }
</style>
