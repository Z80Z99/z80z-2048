<script setup lang="ts">
import { useGameStore } from '../../store/gameStore'
import { getMetaUpgrades } from '../../core/upgrade'

const store = useGameStore()
const upgrades = getMetaUpgrades()
function purchased(id: string) { return store.meta.purchasedIds.includes(id) }
</script>

<template>
  <view class="screen meta-screen"><view class="ui-page meta-content">
    <view class="meta-top"><text class="ui-kicker">让下一次出发更从容</text><button role="button" class="ui-close" @click="store.BACK_TO_TITLE()">返回</button></view>
    <text class="ui-title meta-title">传承殿堂</text>
    <text class="ui-body meta-intro">使用灵魂碎片解锁永久提升。所有效果从下一次新冒险起生效。</text>
    <view class="meta-wallet ui-card"><text>可用灵魂碎片</text><text class="meta-wallet-value">{{ store.meta.totalGold }}</text></view>
    <view class="meta-list"><view v-for="upgrade in upgrades" :key="upgrade.id" class="meta-card" :class="{ 'meta-owned': purchased(upgrade.id) }"><view class="meta-card-heading"><text class="meta-card-name">{{ upgrade.name }}</text><text v-if="purchased(upgrade.id)" class="meta-owned-badge">已解锁</text></view><text class="meta-card-desc">{{ upgrade.description }}</text><button role="button" class="meta-buy" :disabled="purchased(upgrade.id) || store.meta.totalGold < upgrade.cost" @click="store.BUY_META_UPGRADE(upgrade.id)"><text>{{ purchased(upgrade.id) ? '新冒险中生效' : store.meta.totalGold < upgrade.cost ? `还需 ${upgrade.cost - store.meta.totalGold} 碎片` : '解锁传承' }}</text><text v-if="!purchased(upgrade.id)">{{ upgrade.cost }} 碎片</text></button></view></view>
    <button role="button" class="ui-btn ui-btn-secondary meta-back" @click="store.BACK_TO_TITLE()">返回主菜单</button>
  </view></view>
</template>

<style scoped lang="scss">
.meta-screen { padding-bottom: calc(40rpx + var(--safe-bottom)); }
.meta-content { max-width: 760rpx; }
.meta-top { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.meta-title { margin: 28rpx 0 20rpx; }
.meta-intro { margin-bottom: 28rpx; }
.meta-wallet { padding: 22rpx 26rpx; display: flex; justify-content: space-between; align-items: center; gap: 18rpx; margin-bottom: 28rpx; font-size: 28rpx; color: var(--muted); }
.meta-wallet-value { font-size: 46rpx; font-weight: 800; color: var(--xp); }
.meta-list { display: flex; flex-direction: column; gap: 18rpx; }
.meta-card { padding: 24rpx; border: 1px solid var(--line); border-radius: 16rpx; background: var(--surface); }
.meta-card-heading { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; margin-bottom: 12rpx; }
.meta-card-name { color: var(--text); font-size: 32rpx; font-weight: 800; }
.meta-owned-badge { color: var(--hp); font-size: 24rpx; padding: 4rpx 12rpx; border: 1px solid var(--line); border-radius: 6rpx; background: var(--hp-soft); flex-shrink: 0; }
.meta-card-desc { display: block; font-size: 28rpx; line-height: 1.65; color: var(--muted); margin-bottom: 22rpx; }
.meta-buy { display: flex; justify-content: space-between; align-items: center; gap: 12rpx; margin: 0; padding: 16rpx 18rpx; border: 1px solid var(--line); border-radius: 10rpx; color: var(--xp); background: var(--xp-soft); font-size: 26rpx; line-height: 1.5; }
.meta-buy::after { border: none; }
.meta-buy[disabled] { background: var(--surface-soft); color: var(--muted); }
.meta-owned { border-left: 3rpx solid var(--hp); }
.meta-back { margin-top: 30rpx; width: 100%; }
</style>
