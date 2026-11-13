<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../store/gameStore'
import { cardById } from '../core/upgrade'
import { consumableById } from '../core/consumables'
import { summarizeConsumable } from '../utils/displayText'
import { summarizeChoiceCost } from '../core/events'
import type { EventGrant } from '../core/events'
import CardIcon from './CardIcon.vue'
import CardDetails from './CardDetails.vue'

const store = useGameStore()
// 选项代价行与文档生成器共用 core/events.ts 的 summarizeChoiceCost：
// 只显示支付与前提条件，收获与随机结果损失不预告。
const choices = computed(() => (store.gameEvent?.choices ?? []).map((choice, index) => ({
  index, label: choice.label,
  costLine: summarizeChoiceCost(choice.outcomes as never),
  disabledReason: store.eventChoiceDisabledReason(index),
})))
const resultToneClass = computed(() => store.eventResult ? `event-tone-${store.eventResult.tone}` : '')
const grantedCards = computed(() => store.eventResult ? ((store.eventResult.effect.cardGrants ?? []) as EventGrant[]).flatMap(grant => {
  const def = cardById(grant.id)
  return def ? [{ def, count: grant.count }] : []
}) : [])
const grantedSupplies = computed(() => store.eventResult ? ((store.eventResult.effect.consumableGrants ?? []) as EventGrant[]).flatMap(grant => {
  const def = consumableById(grant.id)
  return def ? [{ def, count: grant.count }] : []
}) : [])
const hasBlackGrant = computed(() => grantedCards.value.some(card => card.def.cardClass === 'black'))
function choose(index: number) {
  if (!store.eventChoiceDisabledReason(index)) store.CHOOSE_EVENT(index)
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
        <view class="event-choices">
          <button role="button" v-for="choice in choices" :key="choice.index" class="event-choice" :disabled="Boolean(choice.disabledReason)" @click="choose(choice.index)">
            <view class="event-choice-heading"><text class="event-choice-number">{{ (choice.index + 1).toString().padStart(2, '0') }}</text><text class="event-choice-label">{{ choice.label }}</text><text class="event-choice-arrow">{{ choice.disabledReason ? '—' : '→' }}</text></view>
            <text v-if="choice.costLine" class="event-choice-tip">{{ choice.costLine }}</text>
            <text v-if="choice.disabledReason" class="event-choice-reason">{{ choice.disabledReason }}</text>
          </button>
        </view>
      </template>
      <template v-else>
        <text class="ui-title event-title">{{ store.eventResult.label }}</text>
        <view class="event-result ui-card ui-entry">
          <text class="event-outcome" :class="resultToneClass">【{{ store.eventResult.outcomeLabel }}】</text>
          <text class="ui-body">{{ store.eventResult.desc }}</text>
          <text v-if="hasBlackGrant" class="event-black-mark stat-attack">■ 含黑卡 · 本局不可解除</text>
        </view>
        <view v-for="card in grantedCards" :key="card.def.id" class="event-granted-card card-tone card-frame" :class="`card-${card.def.cardClass}`"><view class="event-granted-title"><CardIcon :icon="card.def.icon" :card-class="card.def.cardClass" size="small" /><text>{{ card.def.name }} ×{{ card.count }}</text></view><CardDetails :card-class="card.def.cardClass" :effects="card.def.effects" :kind="card.def.kind" /></view>
        <view v-for="item in grantedSupplies" :key="item.def.id" class="event-granted-card card-tone card-frame" :class="`card-${item.def.cardClass}`"><view class="event-granted-title"><CardIcon :icon="item.def.icon" :card-class="item.def.cardClass" size="small" /><text>{{ item.def.name }} ×{{ item.count }}</text></view><CardDetails :card-class="item.def.cardClass" :effects="item.def.effects" :summary-lines="summarizeConsumable(item.def)" :duration="item.def.duration" /></view>
        <button role="button" class="ui-btn event-continue" @click="store.LEAVE_EVENT()">离开</button>
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
.event-outcome { display: block; font-size: 34rpx; font-weight: 800; margin-bottom: 14rpx; color: var(--text); }
.event-tone-good { color: var(--accent); }
.event-tone-mid { color: var(--text); }
.event-tone-bad { color: var(--attack); }
.event-black-mark { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 700; }
.event-continue { margin-top: 32rpx; }
.event-granted-card { padding: 20rpx; border: 1px solid var(--line); border-left: 4rpx solid var(--card-color); border-radius: 12rpx; margin: 12rpx 0; background: var(--surface-soft); }
.event-granted-title { display: flex; align-items: center; gap: 14rpx; margin-bottom: 12rpx; font-size: 28rpx; font-weight: 800; }
</style>
