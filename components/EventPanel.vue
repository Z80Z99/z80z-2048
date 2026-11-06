<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../store/gameStore'

const store = useGameStore()
const choices = computed(() => (store.gameEvent?.choices ?? []).map((choice, index) => ({
  ...choice, index, disabledReason: store.eventChoiceDisabledReason(index),
})))
const resultDisabledReason = computed(() => store.eventResult ? store.eventChoiceDisabledReason(store.eventResult.choiceIndex) : null)
function choose(index: number) {
  if (!store.eventChoiceDisabledReason(index)) store.RESOLVE_EVENT(index)
}
</script>

<template>
  <view class="screen event-screen">
    <view class="event-content ui-page">
      <view class="event-top"><text class="ui-kicker">地牢奇遇 / S{{ store.stage }}</text><view class="event-resources"><text class="stat-hp">生命 {{ store.effectivePlayer.hp }}/{{ store.effectivePlayer.maxHp }}</text><text class="stat-gold">{{ store.player.gold }} 金币</text></view></view>
      <view class="event-art"><view class="event-ring"><text class="event-icon">{{ store.gameEvent?.icon || '?' }}</text></view><view class="event-rule" /></view>
      <template v-if="!store.eventResult">
        <text class="ui-title event-title">{{ store.gameEvent?.title || '未知的机遇' }}</text>
        <text class="ui-body event-description">{{ store.gameEvent?.desc || '' }}</text>
        <text class="event-prompt">做出你的选择</text>
        <view class="event-choices">
          <button role="button" v-for="choice in choices" :key="choice.index" class="event-choice" :disabled="Boolean(choice.disabledReason)" @click="choose(choice.index)">
            <view class="event-choice-heading"><text class="event-choice-number">{{ (choice.index + 1).toString().padStart(2, '0') }}</text><text class="event-choice-label">{{ choice.label }}</text><text class="event-choice-arrow">{{ choice.disabledReason ? '—' : '→' }}</text></view>
            <text v-if="choice.tooltip" class="event-choice-tip">{{ choice.tooltip }}</text>
            <text v-if="choice.disabledReason" class="event-choice-reason">{{ choice.disabledReason }}</text>
          </button>
        </view>
      </template>
      <template v-else>
        <text class="ui-title event-title">{{ store.eventResult.label }}</text>
        <view class="event-result ui-card"><text class="ui-body">{{ store.eventResult.desc }}</text></view>
        <text v-if="resultDisabledReason" class="event-choice-reason">{{ resultDisabledReason }}</text>
        <button role="button" class="ui-btn event-continue" :disabled="Boolean(resultDisabledReason)" @click="store.APPLY_EVENT()">继续前进 →</button>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.event-content { max-width: 740rpx; }
.event-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 18rpx; flex-wrap: wrap; }
.event-resources { display: flex; flex-direction: column; align-items: flex-end; gap: 4rpx; font-size: 26rpx; }
.event-art { position: relative; padding: 48rpx 0 38rpx; display: flex; justify-content: center; }
.event-ring { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; width: 144rpx; height: 154rpx; box-sizing: border-box; border: 1px solid var(--accent); border-radius: 72rpx 72rpx 16rpx 16rpx; background: var(--surface); box-shadow: inset 0 0 0 10rpx var(--surface-raised), var(--shadow); }
.event-icon { font-size: 64rpx; color: var(--accent); }
.event-rule { position: absolute; left: 10%; right: 10%; top: 55%; height: 1px; background: var(--line); }
.event-title { text-align: center; margin: 0 0 24rpx; }
.event-description { text-align: center; margin-bottom: 36rpx; white-space: pre-line; }
.event-prompt { display: block; margin-bottom: 16rpx; font-size: 26rpx; color: var(--accent); }
.event-choices { display: flex; flex-direction: column; gap: 16rpx; }
.event-choice { margin: 0; padding: 24rpx; box-sizing: border-box; border: 1px solid var(--line); border-radius: 16rpx; background: var(--surface); text-align: left; color: var(--text); line-height: 1.65; }
.event-choice::after { border: none; }
.event-choice:active { border-color: var(--accent); background: var(--accent-soft); }
.event-choice[disabled] { background: var(--surface-soft); color: var(--muted); border-style: dashed; }
.event-choice-heading { display: flex; align-items: baseline; gap: 16rpx; }
.event-choice-number { font-size: 24rpx; font-weight: 700; color: var(--accent); }
.event-choice-label { flex: 1; font-size: 30rpx; font-weight: 700; white-space: normal; }
.event-choice-arrow { flex-shrink: 0; font-size: 30rpx; color: var(--accent); }
.event-choice-tip { display: block; font-size: 26rpx; color: var(--muted); margin-top: 8rpx; white-space: pre-line; }
.event-choice-reason { display: block; font-size: 26rpx; color: var(--attack); margin-top: 10rpx; }
.event-result { padding: 28rpx; margin: 28rpx 0; white-space: pre-line; }
.event-continue { margin-top: 32rpx; }
</style>
