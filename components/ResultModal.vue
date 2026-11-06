<script setup lang="ts">
import { computed } from 'vue'
import type { BattleResult } from '../types'
import { useGameStore } from '../store/gameStore'
import { equipmentById, formatEquipStats } from '../core/equipment'

const props = defineProps<{ result: BattleResult }>()
const store = useGameStore()
const overflow = computed(() => props.result.overflowDamage ?? 0)
const savedGold = computed(() => props.result.playerWon ? (props.result.savedSteps ?? 0) * 2 : 0)
const drops = computed(() => (props.result.droppedEquipmentIds ?? (props.result.droppedEquipment ? [props.result.droppedEquipment] : [])).map((id, index) => ({
  id, key: `${id}-${index}`, item: equipmentById(id), lines: formatEquipStats(id),
})))
</script>

<template>
  <view class="ui-overlay result-overlay">
    <view class="ui-dialog result-modal">
      <text class="ui-kicker">{{ result.playerWon ? '战利品 / VICTORY' : '战斗记录 / DEFEAT' }}</text>
      <text class="ui-title result-title">{{ result.playerWon ? '道路已清' : '这一次，止步于此' }}</text>
      <text class="ui-note result-summary">与 {{ store.battle?.enemy.name ?? '敌人' }} 交战 {{ result.totalRounds }} 个回合</text>
      <template v-if="result.playerWon">
        <view class="result-rewards">
          <view class="result-reward-row"><text>战斗金币</text><text class="result-number stat-gold">+{{ result.goldEarned }}</text></view>
          <text v-if="savedGold" class="result-saved">其中含保留 {{ result.savedSteps }} 步奖励 +{{ savedGold }} 金币（已计入）</text>
          <view class="result-reward-row"><text>获得经验</text><text class="result-number stat-xp">+{{ result.xpEarned ?? 0 }} XP</text></view>
        </view>
        <view v-if="drops.length" class="result-drops"><text class="result-section-title">装备掉落 · 已放入背包</text><view v-for="drop in drops" :key="drop.key" class="result-drop"><text class="result-drop-name">{{ drop.item?.name ?? '未知装备' }}</text><text v-for="line in drop.lines" :key="line" class="result-drop-stat">{{ line }}</text></view></view>
        <view v-if="overflow > 0" class="result-overflow"><text class="result-section-title">溢出伤害 {{ overflow }} · 选择一种转化</text><view class="result-overflow-choices"><button role="button" class="result-convert result-convert-gold" @click="store.END_BATTLE('gold')"><text class="result-convert-value">+{{ overflow }}</text><text>金币</text></button><button role="button" class="result-convert result-convert-xp" @click="store.END_BATTLE('xp')"><text class="result-convert-value">+{{ Math.floor(overflow / 2) }}</text><text>经验</text></button></view></view>
        <button role="button" v-else class="ui-btn result-continue" @click="store.END_BATTLE()">{{ result.leveledUp ? '领取强化奖励' : '领取奖励并继续' }}</button>
        <text class="result-xp">Lv.{{ store.player.level }} · {{ store.player.xp }} / {{ store.player.xpToNext }} XP</text>
      </template>
      <template v-else><text class="ui-body result-defeat-note">地牢还会在这里。将本次旅程化为传承，再出发。</text><button role="button" class="ui-btn result-continue" @click="store.END_BATTLE()">查看本次结算</button></template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.result-title { font-size: 42rpx; margin: 14rpx 0; }
.result-summary { margin-bottom: 26rpx; }
.result-rewards { padding: 8rpx 0 16rpx; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.result-reward-row { display: flex; justify-content: space-between; align-items: baseline; gap: 20rpx; padding: 14rpx 0; color: var(--muted); font-size: 28rpx; }
.result-number { font-size: 36rpx; font-weight: 800; }
.result-saved { display: block; font-size: 26rpx; color: var(--gold); line-height: 1.6; margin-bottom: 8rpx; }
.result-drops, .result-overflow { margin-top: 24rpx; }
.result-section-title { display: block; color: var(--text); font-size: 28rpx; font-weight: 700; margin-bottom: 16rpx; }
.result-drop { border: 1px solid var(--line); border-left: 3rpx solid var(--xp); background: var(--surface-soft); border-radius: 10rpx; padding: 16rpx 20rpx; margin-top: 12rpx; }
.result-drop-name { display: block; color: var(--text); font-size: 28rpx; font-weight: 700; margin-bottom: 4rpx; }
.result-drop-stat { display: block; color: var(--muted); font-size: 26rpx; line-height: 1.6; }
.result-overflow-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; }
.result-convert { display: flex; flex-direction: column; align-items: center; margin: 0; padding: 20rpx; border: 1px solid var(--line); border-radius: 14rpx; font-size: 26rpx; line-height: 1.5; }
.result-convert::after { border: none; }
.result-convert-gold { color: var(--gold); background: var(--gold-soft); }
.result-convert-xp { color: var(--xp); background: var(--xp-soft); }
.result-convert-value { font-size: 36rpx; font-weight: 800; }
.result-continue { width: 100%; margin-top: 28rpx; }
.result-xp { display: block; color: var(--xp); font-size: 26rpx; text-align: center; margin-top: 24rpx; }
.result-defeat-note { margin: 28rpx 0; }
</style>
