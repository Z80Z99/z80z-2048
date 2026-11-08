<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../store/gameStore'
import { getActualHealGained } from '../../utils/displayText'
import { useFeedback } from '../../composables/useFeedback'

const store = useGameStore()
const player = computed(() => store.effectivePlayer)
const hpPercent = computed(() => Math.max(0, Math.min(100, player.value.hp / Math.max(1, player.value.maxHp) * 100)))
const healGained = computed(() => getActualHealGained(player.value, Math.floor(player.value.maxHp * 0.3), store.activeCardModifiers.healingPenalty))
const feedback = useFeedback()
function heal() {
  const used = store.restUsed
  const before = store.player.hp
  store.REST_HEAL()
  if (!used && store.restUsed) feedback.show(`恢复${store.player.hp - before}点生命，休整完成`)
}
</script>

<template>
  <view class="screen rest-screen"><view class="rest-content">
    <text class="ui-kicker">旅途中的片刻安宁</text>
    <image class="art-scene rest-scene" src="/static/scenes/camp.png" mode="aspectFill" alt="" aria-hidden="true" />
    <text class="ui-title rest-title">营火尚暖</text>
    <text class="ui-body rest-description">卸下疲惫，整理行装。地牢深处的路还很长。</text>
    <view class="rest-card ui-card art-card"><text class="rest-label art-paper-label">{{ store.restUsed ? '本次休整已完成' : '治疗 · 只能休整一次' }}</text><text class="rest-hp">{{ player.hp }} <text>/ {{ player.maxHp }}</text></text><view class="rest-track"><view class="rest-fill" :style="{ width: `${hpPercent}%` }" /></view>
      <text v-if="store.restUsed" :key="feedback.revision.value" class="ui-note rest-note ui-feedback" role="status">{{ feedback.text.value || store.restResult }}</text>
      <template v-else>
        <text class="ui-note rest-note">治疗可恢复 {{ healGained }} 点生命。已计入治疗减少和生命上限；满血也可休整。</text>
        <button role="button" class="ui-btn rest-action ui-press" @click="heal">治疗并休整</button>
        <text class="rest-disabled rest-hint">紫卡要用净化药剂或特定奇遇移除，营火只负责治疗。</text>
      </template>
    </view>
    <button v-if="store.restUsed" role="button" class="ui-btn rest-continue" @click="store.GO_TO_ROUTE()">重返旅途 →</button>
    <button v-else role="button" class="ui-btn ui-btn-quiet rest-continue" @click="store.GO_TO_ROUTE()">先离开，稍后再来</button>
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
.rest-action { width: 100%; min-height: 76rpx; margin-top: 14rpx; padding: 14rpx; }
.rest-hint { color: var(--muted); }
.rest-disabled { display: block; color: var(--attack); font-size: 24rpx; margin-top: 12rpx; }
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
