<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  hp: number
  maxHp: number
  turnsUsed: number
  maxTurns: number
  totalAttack: number
  totalDefense: number
  totalSpeed: number
  gold: number
  round: number
  xp: number
  xpToNext: number
  level: number
  atkMult: number
  defMult: number
  flatAtk: number
  flatDef: number
}>()
const showDetails = ref(false)
const hpPercent = computed(() => Math.max(0, Math.min(100, props.hp / Math.max(1, props.maxHp) * 100)))
const xpPercent = computed(() => Math.max(0, Math.min(100, props.xp / Math.max(1, props.xpToNext) * 100)))
const steps = computed(() => Math.max(0, props.maxTurns - props.turnsUsed))
</script>

<template>
  <view class="status-bar ui-card">
    <view class="sb-top">
      <view class="sb-round"><text class="sb-small">回合</text><text class="sb-round-value">{{ round.toString().padStart(2, '0') }}</text></view>
      <view class="sb-hp">
        <view class="sb-between"><text class="sb-label">生命</text><text class="sb-hp-value">{{ hp }} <text class="sb-muted">/ {{ maxHp }}</text></text></view>
        <view class="sb-track"><view class="sb-hp-fill" :class="{ 'sb-hp-low': hpPercent <= 25 }" :style="{ width: `${hpPercent}%` }" /></view>
      </view>
      <view class="sb-gold"><text class="sb-small">金币</text><text class="sb-gold-value">{{ gold }}</text></view>
    </view>
    <view class="sb-xp">
      <text class="sb-xp-level">Lv.{{ level }}</text>
      <view class="sb-xp-track"><view class="sb-xp-fill" :style="{ width: `${xpPercent}%` }" /></view>
      <text class="sb-small">{{ xp }}/{{ xpToNext }} XP</text>
      <button role="button" class="sb-details-toggle" :aria-expanded="showDetails" aria-controls="player-stat-details" @click="showDetails = !showDetails">属性 {{ showDetails ? '−' : '+' }}</button>
    </view>
    <view class="sb-stats">
      <view class="sb-stat sb-atk"><text class="sb-label">合并蓄力</text><text class="sb-stat-value">{{ totalAttack }}</text></view>
      <view class="sb-stat sb-def"><text class="sb-label">盘面防御</text><text class="sb-stat-value">{{ totalDefense }}</text></view>
      <view class="sb-stat sb-spd"><text class="sb-label">速度</text><text class="sb-stat-value">{{ Number(totalSpeed.toFixed(2)) }}</text></view>
      <view class="sb-stat sb-steps"><text class="sb-label">剩余步数</text><text class="sb-stat-value" :class="{ 'sb-steps-low': steps <= 2 }">{{ steps }}<text class="sb-steps-max">/{{ maxTurns }}</text></text></view>
    </view>
    <view v-if="showDetails" id="player-stat-details" class="sb-details">
      <view class="sb-detail-row"><text>攻击倍率</text><text class="stat-attack">×{{ atkMult.toFixed(2) }}</text></view>
      <view class="sb-detail-row"><text>固定攻击</text><text class="stat-attack">+{{ flatAtk }}</text></view>
      <view class="sb-detail-row"><text>防御倍率</text><text class="stat-defense">×{{ defMult.toFixed(2) }}</text></view>
      <view class="sb-detail-row"><text>固定防御</text><text class="stat-defense">+{{ flatDef }}</text></view>
      <text class="sb-detail-note">属性已计入装备与套装。速度含空格加成；盘面防御之外另有固定防御。本回合已用 {{ turnsUsed }} 步，共 {{ maxTurns }} 步。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.status-bar { padding: 10rpx 16rpx; margin-bottom: 12rpx; }
.sb-top { display: flex; align-items: center; gap: 14rpx; }
.sb-round { display: flex; flex-direction: column; align-items: center; border-right: 1px solid var(--line); padding-right: 14rpx; }
.sb-small, .sb-label { color: var(--muted); font-size: 24rpx; line-height: 1.3; }
.sb-round-value { font-size: 32rpx; font-weight: 800; color: var(--accent); line-height: 1.15; }
.sb-hp { flex: 1; min-width: 0; }
.sb-between { display: flex; align-items: baseline; justify-content: space-between; gap: 8rpx; margin-bottom: 5rpx; }
.sb-hp-value { font-size: 28rpx; line-height: 1.3; font-weight: 800; color: var(--hp); }
.sb-muted { color: var(--muted); font-weight: 400; font-size: 24rpx; }
.sb-track { height: 10rpx; background: var(--track); overflow: hidden; border-radius: 4rpx; }
.sb-hp-fill { height: 100%; background: var(--hp); transition: width 250ms ease; }
.sb-hp-low { background: var(--attack); }
.sb-gold { display: flex; flex-direction: column; align-items: flex-end; }
.sb-gold-value { color: var(--gold); font-size: 30rpx; font-weight: 800; line-height: 1.2; }
.sb-xp { display: flex; align-items: center; gap: 10rpx; margin: 2rpx 0 6rpx; }
.sb-xp-level { font-size: 24rpx; line-height: 1.3; color: var(--xp); font-weight: 700; }
.sb-xp-track { height: 5rpx; background: var(--track); border-radius: 3rpx; overflow: hidden; flex: 1; min-width: 24rpx; }
.sb-xp-fill { height: 100%; background: var(--xp); transition: width 250ms ease; }
.sb-details-toggle { margin: 0; padding: 7rpx 10rpx; min-height: 46rpx; box-sizing: border-box; background: var(--accent-soft); color: var(--accent); border-radius: 8rpx; font-size: 24rpx; line-height: 1.3; white-space: nowrap; }
.sb-details-toggle::after { border: none; }
.sb-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8rpx; }
.sb-stat { display: flex; flex-direction: column; gap: 2rpx; padding: 7rpx 4rpx; text-align: center; background: var(--surface-soft); border-radius: 8rpx; border-top: 2rpx solid var(--line); }
.sb-stat-value { font-size: 32rpx; font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; }
.sb-steps-max { font-size: 22rpx; font-weight: 400; color: var(--muted); margin-left: 3rpx; }
.sb-atk { border-color: var(--attack); }
.sb-atk .sb-stat-value { color: var(--attack); }
.sb-def { border-color: var(--defense); }
.sb-def .sb-stat-value { color: var(--defense); }
.sb-spd { border-color: var(--speed); }
.sb-spd .sb-stat-value { color: var(--speed); }
.sb-steps .sb-stat-value { color: var(--accent); }
.sb-steps .sb-steps-low { color: var(--attack); }
.sb-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10rpx 20rpx; margin-top: 16rpx; padding-top: 16rpx; border-top: 1px solid var(--line); }
.sb-detail-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10rpx; color: var(--muted); font-size: 26rpx; line-height: 1.5; }
.sb-detail-note { grid-column: 1 / -1; color: var(--muted); font-size: 26rpx; line-height: 1.6; }
@media (prefers-reduced-motion: reduce) { .sb-hp-fill, .sb-xp-fill { transition: none; } }
</style>
