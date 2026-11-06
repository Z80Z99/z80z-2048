<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '../../store/gameStore'
import { DEBUG_ENABLED } from '../../store/debugActions'
import BestiaryPanel from '../BestiaryPanel.vue'

const emit = defineEmits<{ 'open-debug': []; 'open-rules': [] }>()
const store = useGameStore()
const showBestiary = ref(false)
</script>

<template>
  <view class="screen title-screen">
    <view class="title-top"><text class="title-edition">2048 · 地牢冒险</text><button role="button" class="title-theme" @click="store.TOGGLE_THEME()">{{ store.theme === 'dark' ? '浅色模式' : '深色模式' }}</button></view>
    <view class="title-main-content">
      <view class="title-gate" aria-hidden="true"><view class="title-gate-inner"><view class="title-rune"><text>2</text><text>4</text><text>8</text><text class="title-rune-bright">16</text></view><view class="title-stair title-stair-one" /><view class="title-stair title-stair-two" /><view class="title-stair title-stair-three" /></view></view>
      <view class="title-brand"><text class="ui-kicker">每次合并，都是一次抉择</text><text class="title-logo">Z80Z</text><text class="title-tagline">把数字化为力量，向地牢深处进发。</text></view>
      <view class="title-actions">
        <button role="button" class="ui-btn title-start" @click="store.START_RUN()"><text>开始冒险</text><text class="title-start-arrow">→</text></button>
        <view class="title-secondary"><button role="button" class="ui-btn ui-btn-secondary" @click="showBestiary = true">怪物图鉴</button><button role="button" class="ui-btn ui-btn-secondary" @click="store.GO_TO_META_SHOP()">永久升级</button></view>
        <button role="button" class="title-rules" @click="emit('open-rules')">第一次来？查看冒险指南</button>
      </view>
      <view class="title-footer"><view class="title-footer-rule" /><text>{{ store.meta.totalRuns }} 次冒险 · {{ store.meta.totalGold }} 灵魂碎片</text><view class="title-footer-rule" /></view>
      <button role="button" v-if="DEBUG_ENABLED" class="title-dev" @click="emit('open-debug')">开发调试</button>
    </view>
    <BestiaryPanel v-if="showBestiary" @close="showBestiary = false" />
  </view>
</template>

<style scoped lang="scss">
.title-screen { display: flex; flex-direction: column; min-height: var(--viewport-height); padding: 28rpx 40rpx calc(44rpx + var(--safe-bottom)); background: radial-gradient(ellipse at 50% 28%, var(--accent-soft), transparent 65%), var(--bg); }
.title-top { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; width: 100%; max-width: 840rpx; margin: 0 auto; }
.title-edition { font-size: 24rpx; letter-spacing: 3rpx; color: var(--muted); }
.title-theme { margin: 0; padding: 12rpx 16rpx; border: 1px solid var(--line); border-radius: 10rpx; color: var(--muted); background: var(--surface); font-size: 24rpx; line-height: 1.4; }
.title-theme::after, .title-rules::after, .title-dev::after { border: none; }
.title-main-content { display: flex; flex-direction: column; align-items: center; flex: 1; justify-content: center; width: 100%; max-width: 620rpx; margin: 30rpx auto 0; }
.title-gate { width: 240rpx; height: 266rpx; box-sizing: border-box; padding: 14rpx 14rpx 0; border: 1px solid var(--line); border-bottom: none; border-radius: 130rpx 130rpx 4rpx 4rpx; background: var(--surface-raised); box-shadow: 0 0 0 10rpx var(--surface-soft), var(--shadow); }
.title-gate-inner { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; border: 1px solid var(--line); border-bottom: none; border-radius: 110rpx 110rpx 0 0; box-sizing: border-box; background: var(--bg); }
.title-rune { display: grid; grid-template-columns: repeat(2, 64rpx); gap: 8rpx; transform: rotate(-7deg); margin-bottom: 22rpx; }
.title-rune text { height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 8rpx; color: var(--text); background: var(--surface-raised); border: 1px solid var(--line); font-size: 32rpx; font-weight: 800; box-shadow: 0 3rpx 0 var(--surface-soft); }
.title-rune .title-rune-bright { color: var(--on-accent); background: var(--accent); border-color: var(--accent); }
.title-stair { position: absolute; height: 15rpx; border: 1px solid var(--line); background: var(--surface-raised); }
.title-stair-one { bottom: 16rpx; left: 12rpx; right: 12rpx; }
.title-stair-two { bottom: 0; left: 2rpx; right: 2rpx; }
.title-stair-three { bottom: -16rpx; left: -14rpx; right: -14rpx; }
.title-brand { text-align: center; margin: 48rpx 0 36rpx; }
.title-logo { font-family: Georgia, 'Times New Roman', serif; font-weight: 800; font-size: 112rpx; line-height: 1.25; letter-spacing: 12rpx; color: var(--accent); display: block; }
.title-tagline { display: block; font-size: 28rpx; color: var(--muted); margin-top: 8rpx; line-height: 1.7; }
.title-actions { width: 100%; }
.title-start { width: 100%; justify-content: space-between; padding: 26rpx 30rpx; font-size: 32rpx; }
.title-start-arrow { font-size: 38rpx; }
.title-secondary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; margin-top: 14rpx; }
.title-rules { width: 100%; margin: 18rpx 0 0; padding: 18rpx 12rpx; color: var(--muted); background: none; font-size: 26rpx; line-height: 1.5; }
.title-footer { display: flex; align-items: center; justify-content: center; gap: 14rpx; width: 100%; margin: 28rpx 0 10rpx; font-size: 24rpx; color: var(--dim); }
.title-footer-rule { height: 1px; max-width: 50rpx; flex: 1; background: var(--line); }
.title-dev { margin: 10rpx 0 0; padding: 8rpx 16rpx; color: var(--xp); background: none; font-size: 24rpx; line-height: 1.5; }
@media (max-height: 650px) { .title-gate { width: 184rpx; height: 208rpx; } .title-rune { grid-template-columns: repeat(2, 48rpx); } .title-rune text { height: 48rpx; font-size: 28rpx; } .title-brand { margin: 36rpx 0 24rpx; } .title-logo { font-size: 96rpx; } }
</style>
