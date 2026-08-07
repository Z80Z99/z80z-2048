<script setup lang="ts">
defineProps<{
  hp: number; maxHp: number; turnsUsed: number; maxTurns: number
  totalAttack: number; totalDefense: number; totalSpeed?: number; gold: number
  round?: number; xp?: number; xpToNext?: number; level?: number
  eqBonus?: { atk: number; def: number; spd: number; hp: number }
  atkMult?: number; defMult?: number
}>()
function hpColor(pct: number) { return pct > 50 ? '#2ecc71' : pct > 25 ? '#f39c12' : '#e74c3c' }
</script>
<template>
  <view class="status-bar">
    <view class="sb-top">
      <view v-if="round != null" class="sb-round-badge"><text class="sb-round-num">R{{ round }}</text></view>
      <view class="sb-hp-wrap">
        <view class="sb-hp-header"><text class="sb-hp-label">HP</text><text class="sb-hp-val">{{ hp }}/{{ maxHp }}</text></view>
        <view class="sb-hp-bar"><view class="sb-hp-fill" :style="{ width: `${Math.max(0, hp/maxHp*100)}%`, background: hpColor(Math.max(0, hp/maxHp*100)) }" /></view>
      </view>
      <view class="sb-gold-badge"><text class="sb-gold-dot">●</text><text class="sb-gold-val">{{ gold }}</text></view>
    </view>
    <view v-if="xp != null && xpToNext != null && level != null" class="sb-xp-row">
      <view class="sb-xp-header"><text class="sb-xp-lv">Lv.{{ level }}</text><text class="sb-xp-nums">{{ xp }}/{{ xpToNext }}</text></view>
      <view class="sb-xp-bar"><view class="sb-xp-fill" :style="{ width: `${Math.min(100, xp/xpToNext*100)}%` }" /></view>
    </view>
    <view class="sb-stats">
      <view class="sb-stat-block sb-atk"><text class="sb-stat-icon">⚔</text><view class="sb-stat-info"><text class="sb-stat-label">攻击</text><text class="sb-stat-val">{{ totalAttack }}</text><view v-if="atkMult != null && atkMult !== 1" class="sb-stat-mod"><text class="sb-stat-mod-txt">×{{ atkMult.toFixed(2) }}</text></view></view></view>
      <view class="sb-stat-block sb-def"><text class="sb-stat-icon">🛡</text><view class="sb-stat-info"><text class="sb-stat-label">防御值</text><text class="sb-stat-val">{{ totalDefense }}</text><view v-if="defMult != null && defMult !== 1" class="sb-stat-mod"><text class="sb-stat-mod-txt">×{{ defMult.toFixed(2) }}</text></view></view></view>
      <view v-if="totalSpeed != null" class="sb-stat-block sb-spd"><text class="sb-stat-icon">⚡</text><view class="sb-stat-info"><text class="sb-stat-label">速度</text><text class="sb-stat-val">{{ totalSpeed }}</text></view></view>
      <view class="sb-turns-block"><text :class="['sb-turns-num', { 'sb-turns-low': maxTurns - turnsUsed <= 2 }]">{{ maxTurns - turnsUsed }}</text><text class="sb-turns-label">步数</text></view>
    </view>
  </view>
</template>
<style lang="scss">
.status-bar { background: linear-gradient(180deg, rgba(20,20,40,0.95), rgba(15,15,30,0.9)); border: 1px solid rgba(255,255,255,0.06); border-radius: 14rpx; padding: 14rpx 16rpx 10rpx; margin-bottom: 12px; }
.sb-top { display: flex; align-items: center; gap: 12rpx; margin-bottom: 10rpx; }
.sb-round-badge { background: rgba(52,152,219,0.2); border: 1px solid rgba(52,152,219,0.3); border-radius: 8rpx; padding: 6rpx 12rpx; }
.sb-round-num { font-size: 30rpx; font-weight: 800; color: #3498db; }
.sb-hp-wrap { flex: 1; } .sb-hp-header { display: flex; justify-content: space-between; margin-bottom: 3rpx; }
.sb-hp-label { font-size: 18rpx; color: #888; } .sb-hp-val { font-size: 22rpx; font-weight: bold; color: #ccc; }
.sb-hp-bar { height: 14rpx; background: rgba(255,255,255,0.06); border-radius: 7rpx; overflow: hidden; }
.sb-hp-fill { height: 100%; border-radius: 7rpx; transition: width 0.4s, background 0.4s; }
.sb-gold-badge { display: flex; align-items: center; gap: 4rpx; background: rgba(241,196,15,0.1); border: 1px solid rgba(241,196,15,0.2); border-radius: 8rpx; padding: 6rpx 14rpx; }
.sb-gold-dot { font-size: 20rpx; color: #f1c40f; } .sb-gold-val { font-size: 26rpx; font-weight: 800; color: #f1c40f; }
.sb-xp-row { margin-bottom: 8rpx; } .sb-xp-header { display: flex; justify-content: space-between; margin-bottom: 2rpx; }
.sb-xp-lv { font-size: 18rpx; font-weight: bold; color: #9b59b6; } .sb-xp-nums { font-size: 18rpx; color: #888; }
.sb-xp-bar { height: 7rpx; background: rgba(255,255,255,0.05); border-radius: 4rpx; overflow: hidden; }
.sb-xp-fill { height: 100%; background: #9b59b6; border-radius: 4rpx; transition: width 0.4s; }
.sb-stats { display: flex; gap: 10rpx; }
.sb-stat-block { flex: 1; display: flex; align-items: center; gap: 8rpx; padding: 10rpx 12rpx; border-radius: 10rpx; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.04); }
.sb-stat-icon { font-size: 28rpx; width: 36rpx; text-align: center; } .sb-stat-info { display: flex; flex-direction: column; }
.sb-stat-label { font-size: 16rpx; color: #888; } .sb-stat-val { font-size: 26rpx; font-weight: 800; }
.sb-stat-mod { margin-top: 2rpx; } .sb-stat-mod-txt { font-size: 16rpx; color: #f1c40f; }
.sb-atk .sb-stat-val { color: #e74c3c; } .sb-atk { border-left: 3rpx solid #e74c3c; }
.sb-def .sb-stat-val { color: #3498db; } .sb-def { border-left: 3rpx solid #3498db; }
.sb-spd .sb-stat-val { color: #f1c40f; } .sb-spd { border-left: 3rpx solid #f1c40f; }
.sb-turns-block { flex: 0.8; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6rpx 8rpx; border-radius: 10rpx; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.04); }
.sb-turns-num { font-size: 36rpx; font-weight: 800; color: #f1c40f; line-height: 1; transition: color 0.3s; }
.sb-turns-low { color: #e74c3c !important; animation: pulse 0.6s infinite alternate; }
.sb-turns-label { font-size: 16rpx; color: #888; margin-top: 2rpx; }
@keyframes pulse { from { opacity: 1; } to { opacity: 0.4; } }
</style>
