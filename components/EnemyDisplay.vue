<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { EnemyDef } from '../types'
import { ROUND_ATK_BONUS, ROUND_DEF_BONUS, ROUND_SPD_BONUS } from '../core/enemy'
import { UPGRADE_POOL } from '../core/upgrade'
const props = withDefaults(defineProps<{ enemy: EnemyDef; currentHp: number; round?: number; enemyAtkDown?: number }>(), { round: 1, enemyAtkDown: 0 })
const hpPercent = computed(() => Math.max(0, (props.currentHp / props.enemy.maxHp) * 100))
const atkBonus = computed(() => (props.round - 1) * ROUND_ATK_BONUS)
const defBonus = computed(() => (props.round - 1) * ROUND_DEF_BONUS)
const spdBonus = computed(() => (props.round - 1) * ROUND_SPD_BONUS)
const effectiveAtkBonus = computed(() => atkBonus.value - props.enemyAtkDown)
const hpColor = computed(() => hpPercent.value > 50 ? '#e74c3c' : hpPercent.value > 25 ? '#e67e22' : '#c0392b')

// 受击反馈：HP 下降时短暂闪白+抖动（仅动画，不影响游戏状态）
const hit = ref(false)
let hitTimer: any = null
watch(() => props.currentHp, (v, old) => {
  if (old === undefined || v >= old) return
  hit.value = true
  if (hitTimer) clearTimeout(hitTimer)
  hitTimer = setTimeout(() => { hit.value = false }, 350)
})
</script>
<template>
  <view class="enemy-card">
    <view class="enemy-body" :class="{ 'hit': hit }">
      <view class="enemy-top"><text class="enemy-name">{{ enemy.name }}</text><view class="enemy-tier"><text class="enemy-tier-text">S{{ enemy.tier > 3 ? 'B' : enemy.tier }}</text></view></view>
    <view class="enemy-hp-section"><view class="enemy-hp-header"><text class="enemy-hp-label">HP</text><text class="enemy-hp-num">{{ currentHp }}/{{ enemy.maxHp }}</text></view><view class="enemy-hp-track"><view class="enemy-hp-fill" :style="{ width: `${hpPercent}%`, background: hpColor }" /></view></view>
    <view class="enemy-stats">
      <view class="enemy-stat-box enemy-stat-atk"><text class="enemy-stat-icon">⚔</text><view class="enemy-stat-info"><text class="enemy-stat-label">攻击</text><view class="enemy-stat-values"><text class="enemy-stat-base">{{ enemy.attack }}</text><text v-if="effectiveAtkBonus !== 0" :class="effectiveAtkBonus >= 0 ? 'enemy-stat-bonus' : 'enemy-stat-nerf'">{{ effectiveAtkBonus >= 0 ? '+' : '' }}{{ effectiveAtkBonus }}</text></view></view></view>
      <view class="enemy-stat-box enemy-stat-def"><text class="enemy-stat-icon">🛡</text><view class="enemy-stat-info"><text class="enemy-stat-label">防御</text><view class="enemy-stat-values"><text class="enemy-stat-base">{{ enemy.defense }}</text><text v-if="defBonus > 0" class="enemy-stat-bonus">+{{ defBonus }}</text></view></view></view>
      <view class="enemy-stat-box enemy-stat-spd"><text class="enemy-stat-icon">⚡</text><view class="enemy-stat-info"><text class="enemy-stat-label">速度</text><view class="enemy-stat-values"><text class="enemy-stat-base">{{ enemy.speed }}</text><text v-if="spdBonus > 0" class="enemy-stat-bonus">+{{ spdBonus }}</text></view></view></view>
    </view>
    <view v-if="(enemy.enemyUpgrades || []).length > 0" class="enemy-upgrades"><text v-for="(uid, i) in enemy.enemyUpgrades" :key="i" class="enemy-upgrade-tag">{{ UPGRADE_POOL.find(x => x.id === uid)?.name ?? uid }}</text></view>
    </view>
  </view>
</template>
<style lang="scss">
.enemy-card { background: linear-gradient(180deg, rgba(40,10,10,0.9), rgba(30,10,20,0.9)); border: 1px solid rgba(231,76,60,0.2); border-radius: 14rpx; padding: 14rpx 16rpx 10rpx; margin-bottom: 16rpx; animation: enemy-in 0.4s ease-out; }
/* 受击动画在内层播放，避免 animation-name 切换导致外层入场动画重播 */
.enemy-body.hit { animation: enemy-hit 0.35s ease-out; }
@keyframes enemy-in { from { opacity: 0; transform: translateY(-12rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes enemy-hit { 0% { filter: brightness(1); transform: translateX(0); } 25% { filter: brightness(2.2); transform: translateX(-8rpx); } 50% { filter: brightness(1.3); transform: translateX(8rpx); } 75% { filter: brightness(1.5); transform: translateX(-4rpx); } 100% { filter: brightness(1); transform: translateX(0); } }
.enemy-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.enemy-name { font-size: 30rpx; font-weight: 800; color: #fff; }
.enemy-tier { background: rgba(231,76,60,0.2); border: 1px solid rgba(231,76,60,0.3); border-radius: 6rpx; padding: 4rpx 12rpx; }
.enemy-tier-text { font-size: 20rpx; font-weight: bold; color: #e74c3c; }
.enemy-hp-section { margin-bottom: 10rpx; } .enemy-hp-header { display: flex; justify-content: space-between; margin-bottom: 3rpx; }
.enemy-hp-label { font-size: 18rpx; color: #888; } .enemy-hp-num { font-size: 22rpx; font-weight: bold; color: #ccc; }
.enemy-hp-track { height: 14rpx; background: rgba(255,255,255,0.06); border-radius: 7rpx; overflow: hidden; }
.enemy-hp-fill { height: 100%; border-radius: 7rpx; transition: width 0.4s, background 0.4s; }
.enemy-stats { display: flex; gap: 10rpx; }
.enemy-stat-box { flex: 1; display: flex; align-items: center; gap: 8rpx; padding: 10rpx 12rpx; border-radius: 10rpx; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.04); }
.enemy-stat-icon { font-size: 28rpx; width: 36rpx; text-align: center; } .enemy-stat-info { display: flex; flex-direction: column; }
.enemy-stat-label { font-size: 16rpx; color: #888; } .enemy-stat-values { display: flex; align-items: baseline; gap: 6rpx; }
.enemy-stat-base { font-size: 26rpx; font-weight: 800; color: #fff; }
.enemy-stat-bonus { font-size: 20rpx; font-weight: 600; color: #e74c3c; }
.enemy-stat-nerf { font-size: 20rpx; font-weight: 600; color: #2ecc71; }
.enemy-stat-atk { border-left: 3rpx solid #e74c3c; } .enemy-stat-def { border-left: 3rpx solid #3498db; } .enemy-stat-spd { border-left: 3rpx solid #f1c40f; }
.enemy-upgrades { display: flex; gap: 6rpx; flex-wrap: wrap; margin-top: 10rpx; }
.enemy-upgrade-tag { font-size: 18rpx; color: #e74c3c; background: rgba(231,76,60,0.1); border: 1px solid rgba(231,76,60,0.2); border-radius: 6rpx; padding: 2rpx 10rpx; }
</style>
