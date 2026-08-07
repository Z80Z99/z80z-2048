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

/* ======== SHARED ANIMATIONS (order matters: later card-pop wins) ======== */
@keyframes title-glow { 0%,100% { text-shadow: 0 0 20px rgba(241,196,15,0.3), 0 0 40px rgba(241,196,15,0.1); } 50% { text-shadow: 0 0 40px rgba(241,196,15,0.6), 0 0 80px rgba(241,196,15,0.3), 0 0 120px rgba(241,196,15,0.15); } }
@keyframes title-fade { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes panel-slide-in { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes panel-slide-out { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
@keyframes hp-glow { 0%, 100% { box-shadow: 0 0 8rpx rgba(46,204,113,0.3); } 50% { box-shadow: 0 0 16rpx rgba(46,204,113,0.5); } }
@keyframes card-pop { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }
@keyframes screen-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
@keyframes layer-rise { from { opacity: 0; transform: translateY(30rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes node-active-glow { 0%,100% { box-shadow: 0 0 8rpx rgba(255,255,255,0.05); } 50% { box-shadow: 0 0 24rpx rgba(255,255,255,0.12); } }
@keyframes screen-enter { from { opacity: 0; filter: brightness(1.5); } to { opacity: 1; filter: brightness(1); } }
@keyframes overlay-in { 0% { opacity: 0 } 100% { opacity: 1 } }
@keyframes card-pop { 0% { opacity: 0; transform: scale(0.8) translateY(30rpx); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes heal-pulse { 0%,100% { text-shadow: 0 0 10px rgba(46,204,113,0.3); } 50% { text-shadow: 0 0 30px rgba(46,204,113,0.7), 0 0 60px rgba(46,204,113,0.3); } }
@keyframes gameover-shake { 0%,100% { transform: translateX(0); } 10%,50%,90% { transform: translateX(-5px); } 30%,70% { transform: translateX(5px); } }
@keyframes boss-victory { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
@keyframes shop-card-in { from { opacity: 0; transform: translateY(30rpx) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

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
