<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '../../store/gameStore'
import TitleScreen from '../../components/screens/TitleScreen.vue'
import RouteScreen from '../../components/screens/RouteScreen.vue'
import BattleScreen from '../../components/screens/BattleScreen.vue'
import RewardScreen from '../../components/screens/RewardScreen.vue'
import ShopScreen from '../../components/screens/ShopScreen.vue'
import RestScreen from '../../components/screens/RestScreen.vue'
import MetaScreen from '../../components/screens/MetaScreen.vue'
import GameOverScreen from '../../components/screens/GameOverScreen.vue'
import BossChoiceScreen from '../../components/screens/BossChoiceScreen.vue'
import EventPanel from '../../components/EventPanel.vue'
import DebugPanel from '../../components/DebugPanel.vue'
import GameRulesPanel from '../../components/GameRulesPanel.vue'
import EquipmentPanel from '../../components/EquipmentPanel.vue'

const store = useGameStore()

// ---- Shared UI state ----
const showRules = ref(false)
const showEquipment = ref(false)
const showDebug = ref(false)
const showToolbar = computed(() => !['title', 'meta', 'gameover', 'boss_choice'].includes(store.screen))
</script>

<template>
  <view class="game-container" :class="`theme-${store.theme}`">
    <TitleScreen v-if="store.screen === 'title'" @open-debug="showDebug = true" />
    <RouteScreen v-if="store.screen === 'route'" />
    <BattleScreen v-if="store.screen === 'battle'" />
    <RewardScreen v-if="store.screen === 'reward'" />
    <ShopScreen v-if="store.screen === 'shop'" />
    <RestScreen v-if="store.screen === 'rest'" />
    <EventPanel v-if="store.screen === 'event'" />
    <MetaScreen v-if="store.screen === 'meta'" />
    <GameOverScreen v-if="store.screen === 'gameover'" />
    <BossChoiceScreen v-if="store.screen === 'boss_choice'" />

    <!-- ============ FLOATING TOOLBAR ============ -->
    <view v-if="showToolbar" class="float-toolbar">
      <view class="float-btn" @click="showRules = true">
        <text class="float-btn-icon">?</text>
        <text class="float-btn-label">规则</text>
      </view>
      <view class="float-btn" @click="showEquipment = true">
        <text class="float-btn-icon">⬡</text>
        <text class="float-btn-label">装备</text>
      </view>
      <view class="float-btn" @click="store.TOGGLE_THEME()">
        <text class="float-btn-icon">{{ store.theme === 'dark' ? '☀' : '☾' }}</text>
      </view>
      <view class="float-btn float-btn-debug" @click="showDebug = true">
        <text class="float-btn-icon">⚙</text>
      </view>
    </view>

    <!-- ============ OVERLAY PANELS ============ -->
    <DebugPanel v-if="showDebug" @close="showDebug = false" />
    <GameRulesPanel v-if="showRules" @close="showRules = false" />
    <EquipmentPanel v-if="showEquipment" @close="showEquipment = false" />
  </view>
</template>

<style lang="scss">
/* ======== GLOBAL RESETS ======== */
.game-container { min-height: 100vh; background: #0d0d1a; }
.screen { min-height: 100vh; padding: 16px; box-sizing: border-box; }

/* 共享 @keyframes 已移至 App.vue（编译进 app.wxss，组件动画才可见） */

/* ======== SCREEN TRANSITION ======== */
.screen, .route-page, .sv2, .gameover-screen, .boss-choice-screen,
.rest-screen, .meta-screen, .title-screen, .reward-screen, .battle-screen {
  animation: screen-in 0.25s ease-out;
}

/* ======== FLOATING TOOLBAR ======== */
.float-toolbar { position: fixed; bottom: 24rpx; left: 50%; transform: translateX(-50%); display: flex; gap: 16rpx; z-index: 50; }
.float-btn { display: flex; flex-direction: row; align-items: center; gap: 6rpx; padding: 10rpx 20rpx; background: rgba(20,20,40,0.85); border-radius: 24rpx; border: 1px solid rgba(255,255,255,0.12); }
.float-btn-icon { font-size: 24rpx; }
.float-btn-label { font-size: 20rpx; color: #888; white-space: nowrap; flex-shrink: 0; }
.float-btn-debug { opacity: 0.35; }
</style>
