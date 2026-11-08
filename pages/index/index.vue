<script setup lang="ts">
import { computed, provide, ref, watch, nextTick, onScopeDispose } from 'vue'
import { useGameStore } from '../../store/gameStore'
import { DEBUG_ENABLED } from '../../store/debugActions'
import { useMotionPreference } from '../../composables/useMotionPreference'
import { useModalMotion } from '../../composables/usePanelMotion'
import { attributeInfo } from '../../utils/attributeInfo'
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
import ConsumablesPanel from '../../components/ConsumablesPanel.vue'
import UpgradesPanel from '../../components/UpgradesPanel.vue'
import AttributeHelp from '../../components/AttributeHelp.vue'

const store = useGameStore()
const reducedMotion = useMotionPreference()
// #ifdef H5
if (typeof window !== 'undefined') {
  const updateReducedClass = () => document.documentElement.classList.toggle('zcode-motion-reduced', reducedMotion.value)
  watch(reducedMotion, updateReducedClass, { immediate: true })
  onScopeDispose(() => document.documentElement.classList.remove('zcode-motion-reduced'))
}
// #endif
provide('motionReduced', reducedMotion)
const rules = useModalMotion(reducedMotion)
const equipment = useModalMotion(reducedMotion)
const consumables = useModalMotion(reducedMotion)
const upgrades = useModalMotion(reducedMotion)
const debug = useModalMotion(reducedMotion)
const attribute = useModalMotion(reducedMotion)
const attributeKey = ref('player.hp')
const helpInfo = computed(() => attributeInfo(attributeKey.value, { player: store.effectivePlayer, basePlayer: store.player, modifiers: store.activeCardModifiers, battle: store.battle, preview: store.battlePreview }))
const consumableCount = computed(() => Object.values(store.consumableCounts).reduce((sum, count) => sum + count, 0))
const showToolbar = computed(() => !['title', 'meta', 'gameover', 'boss_choice'].includes(store.screen))
const stageClass = computed(() => `stage-${['title', 'meta'].includes(store.screen) ? 1 : Math.min(3, Math.max(1, store.stage))}`)
const inputBlocked = computed(() => rules.mounted.value || equipment.mounted.value || consumables.mounted.value || upgrades.mounted.value || debug.mounted.value || attribute.mounted.value)
provide('gameInputBlocked', inputBlocked)
provide('show-attribute-help', (key: string) => {
  attributeKey.value = key
  attribute.open()
})
function blockClosing(event: any, closing: boolean) {
  if (!closing) return
  event.stopPropagation?.()
  event.preventDefault?.()
}
watch(() => store.screen, async () => {
  rules.reset(); equipment.reset(); consumables.reset(); upgrades.reset(); debug.reset(); attribute.reset()
  // #ifdef H5
  await nextTick()
  if (typeof uni !== 'undefined' && typeof uni.pageScrollTo === 'function') uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  // #endif
})
watch(() => store.battle?.phase, phase => { if (phase && phase !== 'playing') attribute.reset() })
function openDebug() { if (DEBUG_ENABLED) debug.open() }
</script>

<template>
  <view class="game-container" :class="[`theme-${store.theme}`, stageClass, { 'motion-reduced': reducedMotion }]">
    <TitleScreen v-if="store.screen === 'title'" @open-debug="openDebug" @open-rules="rules.open()" />
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
      <button role="button" class="float-btn" :disabled="inputBlocked" @click="rules.open()"><text class="float-btn-icon">?</text><text>规则</text></button>
      <button role="button" class="float-btn" :disabled="inputBlocked" @click="equipment.open()"><text class="float-btn-icon">◇</text><text>装备</text></button>
      <button v-if="store.screen === 'battle'" role="button" class="float-btn" :disabled="inputBlocked" :aria-label="`本局强化，共${store.upgrades.length}项`" @click="upgrades.open()"><text>强化 {{ store.upgrades.length }}</text></button>
      <button v-if="store.screen !== 'battle'" role="button" class="float-btn" :disabled="inputBlocked" :aria-label="`道具背包，共${consumableCount}件`" @click="consumables.open()"><text>道具 {{ consumableCount }}</text></button>
      <button role="button" class="float-btn" :disabled="inputBlocked" :aria-label="store.theme === 'dark' ? '切换浅色主题' : '切换深色主题'" @click="store.TOGGLE_THEME()"><text>{{ store.theme === 'dark' ? '浅色' : '深色' }}</text></button>
      <button role="button" v-if="DEBUG_ENABLED" class="float-btn float-btn-debug" :disabled="inputBlocked" @click="openDebug">开发</button>
    </view>

    <view v-if="DEBUG_ENABLED && debug.mounted.value" class="ui-modal-host" :class="{ 'ui-motion-closing': debug.closing.value }" @click.capture="blockClosing($event, debug.closing.value)" @keydown.capture="blockClosing($event, debug.closing.value)" @transitionend="debug.onTransitionEnd"><DebugPanel @close="debug.close()" /></view>
    <view v-if="rules.mounted.value" class="ui-modal-host" :class="{ 'ui-motion-closing': rules.closing.value }" @click.capture="blockClosing($event, rules.closing.value)" @keydown.capture="blockClosing($event, rules.closing.value)" @transitionend="rules.onTransitionEnd"><GameRulesPanel @close="rules.close()" /></view>
    <view v-if="equipment.mounted.value" class="ui-modal-host" :class="{ 'ui-motion-closing': equipment.closing.value }" @click.capture="blockClosing($event, equipment.closing.value)" @keydown.capture="blockClosing($event, equipment.closing.value)" @transitionend="equipment.onTransitionEnd"><EquipmentPanel @close="equipment.close()" /></view>
    <view v-if="consumables.mounted.value" class="ui-modal-host" :class="{ 'ui-motion-closing': consumables.closing.value }" @click.capture="blockClosing($event, consumables.closing.value)" @keydown.capture="blockClosing($event, consumables.closing.value)" @transitionend="consumables.onTransitionEnd"><ConsumablesPanel @close="consumables.close()" /></view>
    <view v-if="upgrades.mounted.value" class="ui-modal-host" :class="{ 'ui-motion-closing': upgrades.closing.value }" @click.capture="blockClosing($event, upgrades.closing.value)" @keydown.capture="blockClosing($event, upgrades.closing.value)" @transitionend="upgrades.onTransitionEnd"><UpgradesPanel @close="upgrades.close()" /></view>
    <view v-if="attribute.mounted.value" class="ui-modal-host ui-attribute-host" :class="{ 'ui-motion-closing': attribute.closing.value }" @click.capture="blockClosing($event, attribute.closing.value)" @keydown.capture="blockClosing($event, attribute.closing.value)" @transitionend="attribute.onTransitionEnd"><AttributeHelp :key="attributeKey" :info="helpInfo" :closing="attribute.closing.value" @close="attribute.close()" /></view>
  </view>
</template>

<style scoped lang="scss">
.float-toolbar { position: fixed; bottom: calc(16rpx + var(--safe-bottom)); left: 50%; transform: translateX(-50%); display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8rpx; width: 660rpx; box-sizing: border-box; max-width: calc(100% - 32rpx); padding: 8rpx; border: 1px solid var(--line); border-radius: 18rpx; background: var(--surface); box-shadow: var(--shadow); z-index: 50; }
.float-btn { display: flex; align-items: center; justify-content: center; gap: 8rpx; min-height: 72rpx; margin: 0; padding: 12rpx 14rpx; border: none; border-radius: 12rpx; background: var(--surface); color: var(--muted); font-size: 26rpx; line-height: 1.3; white-space: nowrap; transition: background-color 120ms ease, color 120ms ease; }
.float-btn::after { border: none; }
.float-btn:active { background: var(--accent-soft); color: var(--accent); }
.float-btn-icon { color: var(--accent); font-size: 30rpx; font-weight: 700; }
.float-btn-debug { color: var(--xp); font-size: 24rpx; }
.combat-toolbar { position: static; left: auto; bottom: auto; transform: none; justify-content: center; box-sizing: border-box; width: 660rpx; max-width: calc(100% - 48rpx); margin: 4rpx auto 0; padding: 6rpx 0 calc(12rpx + var(--safe-bottom)); border: none; border-radius: 0; background: transparent; box-shadow: none; }
.combat-toolbar .float-btn { min-height: 64rpx; padding: 10rpx 18rpx; border: 1px solid var(--line); background: var(--surface); }
</style>
