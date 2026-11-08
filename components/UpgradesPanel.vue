<script setup lang="ts">
import { useGameStore } from '../store/gameStore'
import CardIcon from './CardIcon.vue'
import CardDetails from './CardDetails.vue'

const emit = defineEmits<{ close: [] }>()
const store = useGameStore()
</script>

<template>
  <view class="ui-overlay ui-sheet-overlay upgrades-overlay" @click="emit('close')">
    <view class="ui-sheet" role="dialog" aria-modal="true" aria-label="本局强化" @click.stop>
      <view class="ui-sheet-header"><view><text class="ui-kicker">只读列表 · 不影响战斗</text><text class="ui-sheet-title">本局强化 · {{ store.upgrades.length }} 项</text></view><button role="button" class="ui-close ui-press" @click="emit('close')">关闭</button></view>
      <text class="ui-note upgrades-note">持续卡按持有层数生效；治疗卡领取时已立即使用，不会出现在这里。</text>
      <scroll-view class="ui-scroll" scroll-y>
        <text v-if="!store.upgrades.length" class="ui-note upgrades-note">还未获得强化，升级与探索都能带来新的选择。</text>
        <view v-for="upgrade in store.upgrades" :key="upgrade.def.id" class="upgrade-card card-tone card-frame" :class="`card-${upgrade.def.cardClass}`">
          <view class="upgrade-heading"><CardIcon :card-class="upgrade.def.cardClass" :icon="upgrade.def.icon" size="small" /><view class="upgrade-identity"><text class="upgrade-name">{{ upgrade.def.name }}</text></view><text class="upgrade-count">×{{ upgrade.count }}</text></view>
          <CardDetails :card-class="upgrade.def.cardClass" :effects="upgrade.def.effects" :kind="upgrade.def.kind" :count="upgrade.count" :show-help="false" :context="{ modifiers: store.activeCardModifiers }" />
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.upgrades-overlay { z-index: 120; }
.upgrades-note { margin-bottom: 16rpx; }
.upgrade-card { border: 1px solid var(--line); border-left: 4rpx solid var(--card-color); border-radius: 14rpx; background: var(--surface-soft); padding: 16rpx; margin-bottom: 12rpx; display: flex; flex-direction: column; gap: 8rpx; }
.upgrade-heading { display: flex; align-items: center; gap: 12rpx; }
.upgrade-identity { flex: 1; min-width: 0; }
.upgrade-name { display: block; font-size: 28rpx; font-weight: 800; color: var(--text); line-height: 1.5; }
.upgrade-count { color: var(--gold); font-size: 26rpx; font-weight: 700; }
</style>
