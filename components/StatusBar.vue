<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useFeedback } from '../composables/useFeedback'
import ExpandPanel from './ExpandPanel.vue'
const props = defineProps<{
  hp: number; maxHp: number; turnsUsed: number; maxTurns: number;
  totalAttack: number; totalDefense: number; totalSpeed: number; gold: number;
  round: number; xp: number; xpToNext: number; level: number;
  atkMult: number; defMult: number; flatAtk: number; flatDef: number;
}>()
const emit = defineEmits<{ 'explain': [key: string] }>()
const showHelp = inject<((key: string) => void) | null>('show-attribute-help', null)
function explain(key: string) { if (showHelp) showHelp(key); else emit('explain', key) }
const showDetails = ref(false)
const feedback = useFeedback(1100)
const hpPercent = computed(() => Math.max(0, Math.min(100, props.hp / Math.max(1, props.maxHp) * 100)))
const xpPercent = computed(() => Math.max(0, Math.min(100, props.xp / Math.max(1, props.xpToNext) * 100)))
const steps = computed(() => Math.max(0, props.maxTurns - props.turnsUsed))
watch(() => props.gold, (now, before) => { if (now !== before) feedback.show(`金币 ${now > before ? '+' : '−'}${Math.abs(now - before)}`) })
watch(() => props.level, (now, before) => { if (now > before) feedback.show(`升到 ${now} 级`) })
</script>

<template>
  <view class="status-bar ui-card">
    <view class="sb-top">
      <view class="sb-round"><text class="sb-small">回合</text><text class="sb-round-value">{{ round.toString().padStart(2, '0') }}</text></view>
      <button role="button" class="sb-hp sb-plain" aria-label="查看生命说明" @click="explain('player.hp')"><view class="sb-between"><text class="sb-label">生命</text><text class="sb-hp-value">{{ hp }} <text class="sb-muted">/ {{ maxHp }}</text></text></view><view class="sb-track"><view class="sb-hp-fill" :class="{ 'sb-hp-low': hpPercent <= 25 }" :style="{ width: `${hpPercent}%` }" /></view></button>
      <button role="button" class="sb-gold sb-plain" aria-label="查看金币说明" @click="explain('player.gold')"><text class="sb-small">金币</text><text class="sb-gold-value">{{ gold }}</text></button>
    </view>
    <view class="sb-xp"><button role="button" class="sb-xp-level sb-plain" aria-label="查看等级说明" @click="explain('player.xp')">{{ level }}级</button><button role="button" class="sb-xp-bar sb-plain" aria-label="查看经验说明" @click="explain('player.xp')"><view class="sb-xp-track"><view class="sb-xp-fill" :style="{ width: `${xpPercent}%` }" /></view></button><text class="sb-small">{{ xp }}/{{ xpToNext }}</text><button role="button" class="sb-details-toggle" :aria-expanded="showDetails" @click="showDetails = !showDetails">属性 {{ showDetails ? '−' : '+' }}</button></view>
    <view class="sb-stats">
      <button role="button" class="sb-stat sb-atk" aria-label="查看攻击说明" @click="explain('player.attack')"><text class="sb-label">攻击</text><text class="sb-stat-value">{{ Number(totalAttack.toFixed(2)) }}</text></button>
      <button role="button" class="sb-stat sb-def" aria-label="查看防御说明" @click="explain('player.defense')"><text class="sb-label">防御</text><text class="sb-stat-value">{{ totalDefense + flatDef }}</text></button>
      <button role="button" class="sb-stat sb-spd" aria-label="查看速度说明" @click="explain('player.speed')"><text class="sb-label">速度</text><text class="sb-stat-value">{{ Number(totalSpeed.toFixed(2)) }}</text></button>
      <button role="button" class="sb-stat sb-steps" aria-label="查看步数说明" @click="explain('player.steps')"><text class="sb-label">还能移动</text><text class="sb-stat-value" :class="{ 'sb-steps-low': steps <= 2 }">{{ steps }}<text class="sb-steps-max">/{{ maxTurns }}</text></text></button>
    </view>
    <ExpandPanel :open="showDetails" :revision="`${atkMult}:${defMult}:${flatAtk}:${flatDef}`"><view class="sb-details"><button role="button" class="sb-detail-row sb-plain" @click="explain('player.attack')"><text>攻击增强</text><text class="stat-attack">×{{ atkMult.toFixed(2) }}</text></button><button role="button" class="sb-detail-row sb-plain" @click="explain('player.attack')"><text>装备攻击</text><text class="stat-attack">+{{ flatAtk }}</text></button><button role="button" class="sb-detail-row sb-plain" @click="explain('player.defense')"><text>防御增强</text><text class="stat-defense">×{{ defMult.toFixed(2) }}</text></button><button role="button" class="sb-detail-row sb-plain" @click="explain('player.defense')"><text>装备防御</text><text class="stat-defense">+{{ flatDef }}</text></button><text class="sb-detail-note">点属性查看说明。数值已包含卡片、装备和套装。</text></view></ExpandPanel>
    <text v-if="feedback.text.value" :key="feedback.revision.value" class="sb-feedback ui-feedback" role="status">{{ feedback.text.value }}</text>
  </view>
</template>

<style scoped lang="scss">
.status-bar { position: relative; padding: 10rpx 16rpx; margin-bottom: 12rpx; }
.sb-plain { margin: 0; padding: 0; background: transparent; border: none; color: inherit; font-size: inherit; line-height: inherit; text-align: left; border-radius: 0; }
.sb-plain::after, .sb-stat::after { border: none; }
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
.sb-xp-bar { flex: 1; min-width: 24rpx; padding: 9rpx 0; }
.sb-xp-track { height: 5rpx; background: var(--track); border-radius: 3rpx; overflow: hidden; }
.sb-xp-fill { height: 100%; background: var(--xp); transition: width 250ms ease; }
.sb-details-toggle { margin: 0; padding: 7rpx 10rpx; min-height: 46rpx; box-sizing: border-box; background: var(--accent-soft); color: var(--accent); border-radius: 8rpx; font-size: 24rpx; line-height: 1.3; white-space: nowrap; }
.sb-details-toggle::after { border: none; }
.sb-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8rpx; }
.sb-stat { display: flex; flex-direction: column; gap: 2rpx; margin: 0; padding: 7rpx 4rpx; text-align: center; background: var(--surface-soft); border: 0; border-radius: 8rpx; border-top: 2rpx solid var(--line); line-height: 1.15; }
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
.sb-detail-note { grid-column: 1 / -1; color: var(--muted); font-size: 24rpx; line-height: 1.6; }
.sb-feedback { position: absolute; right: 16rpx; top: 0; background: var(--surface); color: var(--gold); font-size: 24rpx; padding: 5rpx 10rpx; border-radius: 8rpx; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .sb-hp-fill, .sb-xp-fill { transition: none; } }
.motion-reduced .sb-hp-fill, .motion-reduced .sb-xp-fill { transition: none; }
</style>
