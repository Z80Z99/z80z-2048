<script setup lang="ts">
import { useGameStore } from '../../store/gameStore'
import { getMetaUpgrades } from '../../core/upgrade'

const store = useGameStore()

const metaUpgrades = getMetaUpgrades()
</script>

<template>
  <view class="screen meta-screen">
    <text class="meta-title">永久升级</text>
    <text class="meta-gold">灵魂碎片: {{ store.meta.totalGold }}</text>
    <view class="meta-list">
      <view v-for="u in metaUpgrades" :key="u.id"
        :class="['meta-card', { 'meta-purchased': store.meta.purchasedIds.includes(u.id) }]"
        @click="store.BUY_META_UPGRADE(u.id)">
        <view class="meta-card-info">
          <text class="meta-card-name">{{ u.name }}</text>
          <text class="meta-card-desc">{{ u.description }}</text>
        </view>
        <text :class="['meta-card-cost', store.meta.purchasedIds.includes(u.id) ? 'meta-owned' : store.meta.totalGold >= u.cost ? 'meta-affordable' : 'meta-expensive']">{{ store.meta.purchasedIds.includes(u.id) ? '已拥有' : `${u.cost} 碎片` }}</text>
      </view>
    </view>
    <button class="meta-back" @click="store.BACK_TO_TITLE()">返回</button>
  </view>
</template>

<style lang="scss">
.meta-screen { display: flex; flex-direction: column; align-items: center; padding-top: 60px; background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460); }
.meta-title { font-size: 32px; font-weight: bold; color: #f1c40f; margin-bottom: 8px; }
.meta-gold { font-size: 18px; color: #9b59b6; margin-bottom: 24px; }
.meta-list { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
.meta-card { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); transition: all 0.2s; animation: shop-card-in 0.3s ease-out both; }
.meta-card:nth-child(1) { animation-delay: 0.05s; }
.meta-card:nth-child(2) { animation-delay: 0.1s; }
.meta-card:nth-child(3) { animation-delay: 0.15s; }
.meta-card:nth-child(4) { animation-delay: 0.2s; }
.meta-card:nth-child(5) { animation-delay: 0.25s; }
.meta-card:active { transform: scale(0.97); background: rgba(255,255,255,0.08); }
.meta-card-purchased { opacity: 0.5; } .meta-card-info { flex: 1; }
.meta-card-name { font-size: 20px; font-weight: bold; color: #ccc; display: block; } .meta-card-desc { font-size: 14px; color: #888; margin-top: 4px; }
.meta-card-cost { font-size: 16px; font-weight: bold; } .meta-affordable { color: #2ecc71; } .meta-expensive { color: #e74c3c; } .meta-owned { color: #f1c40f; }
.meta-back { background: transparent; color: #888; border: 1px solid #555; border-radius: 8px; font-size: 16px; padding: 10px 32px; margin-top: 16px; }
</style>
