<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../store/gameStore'
import { cardById } from '../core/upgrade'
import { consumableById } from '../core/consumables'
import { summarizeConsumable } from '../utils/displayText'
import type { EventGrant } from '../core/events'
import CardIcon from './CardIcon.vue'
import CardDetails from './CardDetails.vue'

const store = useGameStore()
function cardsFor(effect: Record<string, any>) {
  return ((effect.cardGrants ?? effect.grants ?? []) as EventGrant[]).flatMap(grant => {
    const def = cardById(grant.id)
    return def ? [{ def, count: grant.count }] : []
  })
}
function suppliesFor(effect: Record<string, any>) {
  return ((effect.consumableGrants ?? []) as EventGrant[]).flatMap(grant => {
    const def = consumableById(grant.id)
    return def ? [{ def, count: grant.count }] : []
  })
}
function tradeExpense(effect: Record<string, any>): string {
  const lines = []
  if (effect.cost > 0) lines.push(`支付${effect.cost}金币`)
  if (effect.hpCost > 0) lines.push(`支付${effect.hpCost}点生命（至少保留1点）`)
  if (effect.removesPurple > 0) lines.push(`净化已持有紫卡${effect.removesPurple}层（按持有列表顺序，先减首张紫卡；黑卡不可解除）`)
  const gold = effect.gold
  if (typeof gold === 'number' && gold > 0) lines.push(`另获${gold}金币（先支付，再获得）`)
  else if (gold && typeof gold === 'object') lines.push(`另获${gold.min}~${gold.max}金币（先支付，再获得）`)
  return lines.join('；') || '无金币或生命消耗'
}
function plainTooltip(text: string) {
  return text.replaceAll('最大生命值（含装备）', '生命上限').replaceAll('本局攻击倍率 +8 个百分点', '本局攻击增强8%').replaceAll('本局防御倍率 +12 个百分点', '本局防御增强12%')
}
const choices = computed(() => (store.gameEvent?.choices ?? []).map((choice, index) => ({
  ...choice, index, disabledReason: store.eventChoiceDisabledReason(index),
  cards: cardsFor(choice.effect), supplies: suppliesFor(choice.effect),
  tip: choice.effect.type === 'card_trade' ? tradeExpense(choice.effect) : plainTooltip(choice.tooltip ?? ''),
})))
const resultDisabledReason = computed(() => store.eventResult ? store.eventChoiceDisabledReason(store.eventResult.choiceIndex) : null)
const grantedCards = computed(() => store.eventResult ? cardsFor(store.eventResult.effect) : [])
const grantedSupplies = computed(() => store.eventResult ? suppliesFor(store.eventResult.effect) : [])
const resultText = computed(() => !store.eventResult ? '' : store.eventResult.effect.type === 'card_trade' ? tradeExpense(store.eventResult.effect) : plainTooltip(store.eventResult.desc))
const needsBlackConfirmation = computed(() => store.eventResult?.effect.requiresBlackConfirmation === true)
const continueBlocked = computed(() => Boolean(resultDisabledReason.value) || (needsBlackConfirmation.value && !store.eventBlackConfirmed))
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
        <text class="event-prompt">每次奇遇只选一项 · 先查看，再确认</text>
        <view class="event-choices">
          <button role="button" v-for="choice in choices" :key="choice.index" class="event-choice" :disabled="Boolean(choice.disabledReason)" @click="choose(choice.index)">
            <view class="event-choice-heading"><text class="event-choice-number">{{ (choice.index + 1).toString().padStart(2, '0') }}</text><text class="event-choice-label">{{ choice.label }}</text><text class="event-choice-arrow">{{ choice.disabledReason ? '—' : '→' }}</text></view>
            <text v-if="choice.tip" class="event-choice-tip">{{ choice.tip }}</text>
            <view v-for="card in choice.cards" :key="card.def.id" class="event-granted-card card-tone card-frame" :class="`card-${card.def.cardClass}`"><view class="event-granted-title"><CardIcon :icon="card.def.icon" :card-class="card.def.cardClass" size="small" /><text>{{ card.def.name }} ×{{ card.count }}</text></view><CardDetails :card-class="card.def.cardClass" :effects="card.def.effects" :kind="card.def.kind" /></view>
            <view v-for="item in choice.supplies" :key="item.def.id" class="event-granted-card card-tone card-frame" :class="`card-${item.def.cardClass}`"><view class="event-granted-title"><CardIcon :icon="item.def.icon" :card-class="item.def.cardClass" size="small" /><text>{{ item.def.name }} ×{{ item.count }}</text></view><CardDetails :card-class="item.def.cardClass" :effects="item.def.effects" :summary-lines="summarizeConsumable(item.def)" :duration="item.def.duration" /><text class="ui-note">存入背包，不会自动使用</text></view>
            <text v-if="choice.disabledReason" class="event-choice-reason">{{ choice.disabledReason }}</text>
          </button>
        </view>
      </template>
      <template v-else>
        <text class="ui-title event-title">{{ store.eventResult.label }}</text>
        <view class="event-result ui-card ui-entry"><text class="event-prompt">尚未生效 · 确认后结算</text><text class="ui-body">{{ resultText }}</text></view>
        <view v-for="card in grantedCards" :key="card.def.id" class="event-granted-card card-tone card-frame" :class="`card-${card.def.cardClass}`"><view class="event-granted-title"><CardIcon :icon="card.def.icon" :card-class="card.def.cardClass" size="small" /><text>{{ card.def.name }} ×{{ card.count }}</text></view><CardDetails :card-class="card.def.cardClass" :effects="card.def.effects" :kind="card.def.kind" /></view>
        <view v-for="item in grantedSupplies" :key="item.def.id" class="event-granted-card card-tone card-frame" :class="`card-${item.def.cardClass}`"><view class="event-granted-title"><CardIcon :icon="item.def.icon" :card-class="item.def.cardClass" size="small" /><text>{{ item.def.name }} ×{{ item.count }}</text></view><CardDetails :card-class="item.def.cardClass" :effects="item.def.effects" :summary-lines="summarizeConsumable(item.def)" :duration="item.def.duration" /><text class="ui-note">存入背包，不会自动使用</text></view>
        <view v-if="needsBlackConfirmation" class="event-black-warning"><text class="event-black-title">■ 黑卡代价 · 本局永久且不可解除</text><text class="ui-note">这是本局不可解除的负面效果。商店、营地和净化道具都无法解除。先确认接受，再另点「继续前进」才会生效。</text><button role="button" class="ui-btn event-danger" :disabled="store.eventBlackConfirmed" @click="store.CONFIRM_BLACK_EVENT()">{{ store.eventBlackConfirmed ? '已确认不可解除代价' : '确认接受不可解除代价' }}</button></view>
        <text v-if="resultDisabledReason" class="event-choice-reason">{{ resultDisabledReason }}</text>
        <button role="button" class="ui-btn event-continue" :disabled="continueBlocked" @click="store.APPLY_EVENT()">继续前进 →</button>
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
.event-granted-card { padding: 20rpx; border: 1px solid var(--line); border-left: 4rpx solid var(--card-color); border-radius: 12rpx; margin: 12rpx 0; background: var(--surface-soft); }
.event-granted-title { display: flex; align-items: center; gap: 14rpx; margin-bottom: 12rpx; font-size: 28rpx; font-weight: 800; }
.event-black-warning { padding: 20rpx; border: 2px solid var(--attack); border-radius: 14rpx; margin-top: 20rpx; background: var(--attack-soft); }
.event-black-title { display: block; color: var(--attack); font-size: 28rpx; font-weight: 800; margin-bottom: 10rpx; }
.event-danger { width: 100%; margin-top: 16rpx; background: var(--attack); border-color: var(--attack); color: var(--bg); font-size: 26rpx; }
</style>
