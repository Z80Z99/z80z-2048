<script setup lang="ts">
import { ref, computed, provide, watch, nextTick } from 'vue'
import { useGameStore } from '../../store/gameStore'
import { DEBUG_ENABLED } from '../../store/debugActions'
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
const showRules = ref(false)
const showEquipment = ref(false)
const showDebug = ref(false)
const showToolbar = computed(() => !['title', 'meta', 'gameover', 'boss_choice'].includes(store.screen))
const stageClass = computed(() => `stage-${['title', 'meta'].includes(store.screen) ? 1 : Math.min(3, Math.max(1, store.stage))}`)
provide('gameInputBlocked', computed(() => showRules.value || showEquipment.value || showDebug.value))
watch(() => store.screen, async () => {
  showRules.value = false
  showEquipment.value = false
  showDebug.value = false
  // #ifdef H5
  await nextTick()
  if (typeof uni !== 'undefined' && typeof uni.pageScrollTo === 'function') {
    uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  }
  // #endif
})
function openDebug() {
  if (DEBUG_ENABLED) showDebug.value = true
}
</script>

<template>
  <view class="game-container" :class="[`theme-${store.theme}`, stageClass]">
    <TitleScreen v-if="store.screen === 'title'" @open-debug="openDebug" @open-rules="showRules = true" />
    <RouteScreen v-else-if="store.screen === 'route'" />
    <BattleScreen v-else-if="store.screen === 'battle'" />
    <RewardScreen v-else-if="store.screen === 'reward'" />
    <ShopScreen v-else-if="store.screen === 'shop'" />
    <RestScreen v-else-if="store.screen === 'rest'" />
    <EventPanel v-else-if="store.screen === 'event'" />
    <MetaScreen v-else-if="store.screen === 'meta'" />
    <GameOverScreen v-else-if="store.screen === 'gameover'" />
    <BossChoiceScreen v-else-if="store.screen === 'boss_choice'" />

    <view v-if="showToolbar" class="float-toolbar" :class="{ 'combat-toolbar': store.screen === 'battle' }">
      <button role="button" class="float-btn" @click="showRules = true"><text class="float-btn-icon">?</text><text>规则</text></button>
      <button role="button" class="float-btn" @click="showEquipment = true"><text class="float-btn-icon">◇</text><text>装备</text></button>
      <button role="button" class="float-btn" :aria-label="store.theme === 'dark' ? '切换浅色主题' : '切换深色主题'" @click="store.TOGGLE_THEME()">
        <text>{{ store.theme === 'dark' ? '浅色' : '深色' }}</text>
      </button>
      <button role="button" v-if="DEBUG_ENABLED" class="float-btn float-btn-debug" @click="openDebug">开发</button>
    </view>

    <DebugPanel v-if="DEBUG_ENABLED && showDebug" @close="showDebug = false" />
    <GameRulesPanel v-if="showRules" @close="showRules = false" />
    <EquipmentPanel v-if="showEquipment" @close="showEquipment = false" />
  </view>
</template>

<style scoped lang="scss">
.float-toolbar { position: fixed; bottom: calc(16rpx + var(--safe-bottom)); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8rpx; max-width: calc(100% - 32rpx); padding: 8rpx; border: 1px solid var(--line); border-radius: 18rpx; background: var(--surface); box-shadow: var(--shadow); z-index: 50; }
.float-btn { display: flex; align-items: center; justify-content: center; gap: 8rpx; min-height: 72rpx; margin: 0; padding: 12rpx 20rpx; border: none; border-radius: 12rpx; background: var(--surface); color: var(--muted); font-size: 26rpx; line-height: 1.3; white-space: nowrap; }
.float-btn::after { border: none; }
.float-btn:active { background: var(--accent-soft); color: var(--accent); }
.float-btn-icon { color: var(--accent); font-size: 30rpx; font-weight: 700; }
.float-btn-debug { color: var(--xp); font-size: 24rpx; }
/* 战斗工具栏参与普通布局，短屏滚动时也不会盖住棋盘或结束按钮。 */
.combat-toolbar { position: static; left: auto; bottom: auto; transform: none; justify-content: center; box-sizing: border-box; width: 660rpx; max-width: calc(100% - 48rpx); margin: 4rpx auto 0; padding: 6rpx 0 calc(12rpx + var(--safe-bottom)); border: none; border-radius: 0; background: transparent; box-shadow: none; }
.combat-toolbar .float-btn { min-height: 64rpx; padding: 10rpx 18rpx; border: 1px solid var(--line); background: var(--surface); }
</style>
