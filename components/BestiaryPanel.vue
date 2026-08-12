<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../store/gameStore'
import { ENEMIES } from '../core/enemy'
defineEmits<{ close: [] }>()
const store = useGameStore()
const m = computed(() => store.meta)
const found = computed(() => m.value.unlockedEnemies.length)
const totalDisc = computed(() => { let d = 0; for (const v of Object.values(m.value.enemyKills)) d += Math.floor(v / 5); return d })
const nextGlobal = computed(() => (m.value.globalClaimLevel + 1) * 20)
const canClaimGlobal = computed(() => totalDisc.value >= nextGlobal.value)
const tierInfo: Record<number, { name: string; color: string; glow: string }> = { 1: { name: '普通', color: '#7f8c8d', glow: 'rgba(127,140,141,0.3)' }, 2: { name: '中级', color: '#3498db', glow: 'rgba(52,152,219,0.3)' }, 3: { name: '精英', color: '#e67e22', glow: 'rgba(230,126,34,0.3)' }, 4: { name: 'BOSS', color: '#c0392b', glow: 'rgba(192,57,43,0.4)' } }
const grouped = computed(() => { const g: Record<number, typeof ENEMIES> = {}; for (const e of ENEMIES) { if (!g[e.tier]) g[e.tier] = []; g[e.tier].push(e) } return g })
</script>
<template>
  <view class="bestiary-overlay"><view class="bestiary-blur" @click="$emit('close')" />
    <view class="bestiary-panel">
      <view class="bs-header"><view class="bs-header-left"><text class="bs-title">怪物图鉴</text><view class="bs-count-badge"><text class="bs-count-text">{{ found }}/{{ ENEMIES.length }}</text></view></view><view class="bs-close" @click="$emit('close')"><text class="bs-close-x">×</text></view></view>
      <view class="bs-global-card"><view class="bs-global-top"><view class="bs-global-info"><text class="bs-global-icon">◈</text><view><text class="bs-global-title">探索进度 · 下一奖励</text><text class="bs-global-nums">{{ totalDisc }}<text class="bs-global-div"> / {{ nextGlobal }}</text></text></view></view><view v-if="canClaimGlobal" class="bs-claim" @click="store.CLAIM_BESTIARY_REWARD('global')"><text class="bs-claim-label">领取</text><text class="bs-claim-bonus">+10碎片 +3生命</text></view><text v-else class="bs-global-remain">距下次 {{ nextGlobal - totalDisc }} 次</text></view><view class="bs-progress"><view class="bs-progress-fill bs-progress-gold" :style="{ width: `${Math.min(100, totalDisc / nextGlobal * 100)}%` }" /></view></view>
      <scroll-view class="bs-body" scroll-y>
        <view v-for="tier in [1,2,3,4]" :key="tier"><template v-if="grouped[tier]?.length"><view class="bs-tier"><view class="bs-tier-header"><view class="bs-tier-dot" :style="{ background: tierInfo[tier].color, boxShadow: `0 0 8rpx ${tierInfo[tier].glow}` }" /><text class="bs-tier-name" :style="{ color: tierInfo[tier].color }">{{ tierInfo[tier].name }}</text></view>
          <view v-for="e in grouped[tier]" :key="e.id" :class="['bs-card', { 'bs-card-locked': !m.unlockedEnemies.includes(e.id) }]">
            <view class="bs-card-main"><text class="bs-card-name">{{ m.unlockedEnemies.includes(e.id) ? e.name : '???' }}</text>
              <view v-if="m.unlockedEnemies.includes(e.id)" class="bs-card-stats"><view class="bs-stat"><text class="bs-stat-icon">❤</text><text class="bs-stat-val">{{ e.hp }}</text></view><view class="bs-stat"><text class="bs-stat-icon">⚔</text><text class="bs-stat-val">{{ e.attack }}</text></view><view class="bs-stat"><text class="bs-stat-icon">🛡</text><text class="bs-stat-val">{{ e.defense }}</text></view><view class="bs-stat"><text class="bs-stat-icon">⚡</text><text class="bs-stat-val">{{ e.speed }}</text></view></view>
              <text v-else class="bs-unknown">击败后解锁</text></view>
            <view v-if="m.unlockedEnemies.includes(e.id)" class="bs-card-side"><text class="bs-side-count">{{ (m.enemyKills[e.id] || 0) }}/{{ ((m.enemyClaims[e.id] || 0) + 1) * 5 }}</text><view class="bs-progress bs-progress-sm"><view class="bs-progress-fill bs-progress-gold" :style="{ width: `${Math.min(100, ((m.enemyKills[e.id] || 0) % 5) / 5 * 100)}%` }" /></view><view v-if="Math.floor((m.enemyKills[e.id] || 0) / 5) > (m.enemyClaims[e.id] || 0)" class="bs-claim bs-claim-sm" @click="store.CLAIM_BESTIARY_REWARD('enemy', e.id)"><text class="bs-claim-bonus">+3</text></view><text v-else class="bs-side-disc">×{{ Math.floor((m.enemyKills[e.id] || 0) / 5) }}</text></view></view></view></template></view>
        <view style="height: 60px;" />
      </scroll-view>
    </view>
  </view>
</template>
<style lang="scss">
.bestiary-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 85; display: flex; align-items: flex-end; }
.bestiary-blur { position: absolute; inset: 0; background: rgba(0,0,0,0.6); }
.bestiary-panel { position: relative; width: 100%; height: 80vh; background: #1a1a2e; border-radius: 24rpx 24rpx 0 0; padding: 24rpx 20rpx 20rpx; display: flex; flex-direction: column; }
.bs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14rpx; }
.bs-header-left { display: flex; align-items: center; gap: 12rpx; }
.bs-title { font-size: 30rpx; font-weight: bold; color: #f1c40f; }
.bs-count-badge { background: rgba(155,89,182,0.2); border: 1px solid rgba(155,89,182,0.3); border-radius: 6rpx; padding: 4rpx 12rpx; }
.bs-count-text { font-size: 22rpx; color: #9b59b6; font-weight: bold; } .bs-close { padding: 8rpx; } .bs-close-x { font-size: 28rpx; color: #888; }
.bs-global-card { background: rgba(255,255,255,0.03); border-radius: 12rpx; padding: 16rpx; margin-bottom: 14rpx; }
.bs-global-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.bs-global-info { display: flex; align-items: center; gap: 10rpx; } .bs-global-icon { font-size: 32rpx; color: #f1c40f; }
.bs-global-title { font-size: 22rpx; color: #888; display: block; } .bs-global-nums { font-size: 26rpx; font-weight: bold; color: #ccc; } .bs-global-div { color: #555; font-weight: normal; }
.bs-global-remain { font-size: 20rpx; color: #555; }
.bs-claim { background: rgba(46,204,113,0.15); border: 1px solid rgba(46,204,113,0.3); border-radius: 8rpx; padding: 8rpx 14rpx; }
.bs-claim-label { font-size: 18rpx; color: #2ecc71; font-weight: bold; display: block; } .bs-claim-bonus { font-size: 16rpx; color: #2ecc71; }
.bs-progress { height: 6rpx; background: rgba(255,255,255,0.06); border-radius: 3rpx; overflow: hidden; } .bs-progress-sm { margin: 4rpx 0; }
.bs-progress-gold { background: linear-gradient(90deg, #f1c40f, #e67e22); } .bs-progress-fill { height: 100%; border-radius: 3rpx; }
.bs-body { flex: 1; height: 0; } .bs-tier { margin-bottom: 16rpx; } .bs-tier-header { display: flex; align-items: center; gap: 8rpx; margin-bottom: 8rpx; }
.bs-tier-dot { width: 12rpx; height: 12rpx; border-radius: 6rpx; } .bs-tier-name { font-size: 22rpx; font-weight: bold; }
.bs-card { display: flex; align-items: center; justify-content: space-between; padding: 12rpx; border-radius: 10rpx; background: rgba(255,255,255,0.02); margin-bottom: 6rpx; }
.bs-card-locked { opacity: 0.3; } .bs-card-main { flex: 1; } .bs-card-name { font-size: 24rpx; font-weight: bold; color: #ccc; display: block; margin-bottom: 6rpx; }
.bs-card-stats { display: flex; gap: 14rpx; } .bs-stat { display: flex; align-items: center; gap: 2rpx; } .bs-stat-icon { font-size: 18rpx; } .bs-stat-val { font-size: 20rpx; color: #888; }
.bs-unknown { font-size: 20rpx; color: #555; } .bs-card-side { display: flex; flex-direction: column; align-items: flex-end; min-width: 80rpx; }
.bs-side-count { font-size: 18rpx; color: #888; } .bs-side-disc { font-size: 20rpx; color: #f1c40f; font-weight: bold; } .bs-claim-sm { padding: 4rpx 12rpx; }
</style>
