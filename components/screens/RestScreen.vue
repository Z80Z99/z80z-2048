<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../store/gameStore'

const store = useGameStore()
const player = computed(() => store.effectivePlayer)
const hpPercent = computed(() => Math.max(0, Math.min(100, player.value.hp / Math.max(1, player.value.maxHp) * 100)))
</script>

<template>
  <view class="screen rest-screen"><view class="rest-content">
    <text class="ui-kicker">旅途中的片刻安宁</text>
    <image class="art-scene rest-scene" src="/static/scenes/camp.png" mode="aspectFill" alt="" aria-hidden="true" />
    <text class="ui-title rest-title">营火尚暖</text>
    <text class="ui-body rest-description">卸下疲惫，整理行装。地牢深处的路还很长。</text>
    <view class="rest-card ui-card art-card"><text class="rest-label art-paper-label">营地治疗已生效</text><text class="rest-hp">{{ player.hp }} <text>/ {{ player.maxHp }}</text></text><view class="rest-track"><view class="rest-fill" :style="{ width: `${hpPercent}%` }" /></view><text class="ui-note rest-note">按生命上限的 30% 回复（最多 {{ Math.floor(player.maxHp * 0.3) }} 点），不超过生命上限。</text></view>
    <button role="button" class="ui-btn rest-continue" @click="store.GO_TO_ROUTE()">重返旅途 →</button>
  </view></view>
</template>

<style scoped lang="scss">
.rest-screen { display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 35%, var(--hp-soft), transparent 65%), var(--bg); }
.rest-content { width: 100%; max-width: 640rpx; text-align: center; padding: 40rpx 0; }
.rest-scene { margin: 28rpx auto 26rpx; }
.rest-title { margin-bottom: 20rpx; }
.rest-description { margin-bottom: 30rpx; }
.rest-card { padding: 28rpx; text-align: left; }
.rest-label { font-size: 26rpx; color: var(--hp); }
.rest-hp { font-size: 52rpx; font-weight: 800; display: block; color: var(--hp); margin: 12rpx 0; }
.rest-hp text { font-size: 28rpx; font-weight: 400; color: var(--muted); }
.rest-track { height: 16rpx; border-radius: 5rpx; background: var(--track); overflow: hidden; }
.rest-fill { height: 100%; background: var(--hp); }
.rest-note { margin-top: 20rpx; }
.rest-continue { width: 100%; margin-top: 28rpx; }
@media (max-height: 700px) {
  .rest-content { padding: 12rpx 0; }
  .rest-scene { margin: 16rpx auto; }
  .rest-description { margin-bottom: 20rpx; }
}
@media (max-height: 560px) {
  .rest-screen { align-items: flex-start; }
  .rest-content { padding: 0; }
  .rest-title { margin-bottom: 12rpx; }
  .rest-card { padding: 20rpx; }
  .rest-continue { margin-top: 18rpx; }
}
</style>
