<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { Cell, Direction } from '../types'
import { useGameStore } from '../store/gameStore'
import { useSwipe } from '../composables/useSwipe'
import {
  BOARD_ATTACK_FLOAT_MS, BOARD_IMPACT_MS, BOARD_MOVE_MS, buildBoardRenderPlan,
  copyBoardGrid, createBoardEffectScheduler, formatAttackGain, slideAttackDelta, snapshotBoard, tileColors,
} from '../utils/boardEffects'
import type { AttackSnapshot, BoardTile, MergeImpact, TrailEcho } from '../utils/boardEffects'
import Tile from './Tile.vue'

const MOVE_MS = BOARD_MOVE_MS
const store = useGameStore()
const inputBlocked = inject<Ref<boolean>>('gameInputBlocked', ref(false))
const sharedReducedMotion = inject<Ref<boolean> | null>('motionReduced', null)
const reducedMotion = sharedReducedMotion ?? ref(false)
const grid = computed(() => store.battle?.grid ?? [])
const tiles = ref<BoardTile[]>([])
const echoes = ref<TrailEcho[]>([])
const impacts = ref<MergeImpact[]>([])
const edgeKey = ref<string | null>(null)
const attackFloat = ref<{ key: string; value: number } | null>(null)
const moving = ref(false)
const enabled = computed(() => store.screen === 'battle' && store.battle?.phase === 'playing' && !inputBlocked.value)
const context = computed(() => `${store.screen}:${store.currentNodeId}:${store.battle?.round ?? ''}`)
const scheduler = createBoardEffectScheduler()
let previous: Cell[][] = []
let previousContext = context.value
let revision = 0
let pendingAttack = 0

function clearEffects(settle = true) {
  scheduler.clear()
  echoes.value = []
  impacts.value = []
  edgeKey.value = null
  attackFloat.value = null
  pendingAttack = 0
  moving.value = false
  if (settle) tiles.value = snapshotBoard(grid.value)
}

watch(grid, nextGrid => {
  clearEffects(false)
  const canAnimate = previousContext === context.value && store.screen === 'battle' && !inputBlocked.value
  const plan = buildBoardRenderPlan(previous, nextGrid, ++revision, reducedMotion.value || !canAnimate)
  tiles.value = plan.tiles
  echoes.value = plan.echoes
  previous = copyBoardGrid(nextGrid)
  previousContext = context.value
  moving.value = plan.moving
  if (!plan.moving) return
  scheduler.schedule(MOVE_MS, () => {
    tiles.value = plan.tiles.filter(tile => !tile.leaving).map(tile => ({ ...tile, pending: false }))
    echoes.value = []
    moving.value = false
    impacts.value = plan.impacts
    edgeKey.value = plan.edgeKey
    if (pendingAttack > 0) {
      attackFloat.value = { key: `zbfx-${revision}-attack`, value: formatAttackGain(pendingAttack) }
      scheduler.schedule(BOARD_ATTACK_FLOAT_MS, () => { attackFloat.value = null })
    }
    pendingAttack = 0
    if (plan.impacts.length || plan.edgeKey) {
      scheduler.schedule(BOARD_IMPACT_MS, () => { impacts.value = []; edgeKey.value = null })
    }
  })
}, { immediate: true, flush: 'sync' })

function attackSnapshot(): AttackSnapshot | null {
  const battle = store.battle
  return battle ? { nodeId: store.currentNodeId, round: battle.round, turnsUsed: battle.turnsUsed, totalAttack: battle.totalAttack } : null
}

function slide(direction: Direction) {
  if (!enabled.value || moving.value) return
  const battle = store.battle
  const before = attackSnapshot()
  store.SLIDE(direction)
  const after = attackSnapshot()
  if (!before || !after) return
  const delta = slideAttackDelta(before, after, store.battle !== battle)
  // 减少动态效果时没有移动动画；攻击增量仍以静态文字短暂显示，不静默丢失。
  if (reducedMotion.value) {
    if (delta > 0 && !inputBlocked.value) {
      attackFloat.value = { key: `zbfx-${revision}-attack-static`, value: formatAttackGain(delta) }
      scheduler.schedule(BOARD_ATTACK_FLOAT_MS, () => { attackFloat.value = null })
    }
    return
  }
  if (inputBlocked.value || !moving.value) return
  pendingAttack = delta
}
const boardElement = ref<any>(null)
const { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } = useSwipe(slide, () => enabled.value && !moving.value)
watch(enabled, value => { if (!value) onTouchCancel() }, { flush: 'sync' })
watch(inputBlocked, value => {
  if (value) { onTouchCancel(); clearEffects() }
}, { flush: 'sync' })
watch(reducedMotion, value => {
  if (value) { onTouchCancel(); clearEffects() }
}, { flush: 'sync' })
watch(context, () => {
  onTouchCancel()
  clearEffects()
  previous = copyBoardGrid(grid.value)
  previousContext = context.value
}, { flush: 'sync' })

function position(tile: BoardTile) {
  return { transform: `translate(${tile.col * 100}%, ${tile.row * 100}%)` }
}
function echoStyle(echo: TrailEcho) {
  return {
    '--zbfx-from': `translate(${echo.from.col * 100}%, ${echo.from.row * 100}%)`,
    '--zbfx-to': `translate(${echo.to.col * 100}%, ${echo.to.row * 100}%)`,
    '--zbfx-face': tileColors(echo.value).face,
  }
}
function impactFor(tile: BoardTile) {
  return tile.leaving ? undefined : impacts.value.find(impact => impact.cellId === tile.cell.id)
}

let disposeKeyboard: (() => void) | undefined
onMounted(() => {
  // #ifdef H5
  if (typeof window === 'undefined') return
  const element = (boardElement.value?.$el ?? boardElement.value) as HTMLElement | null
  element?.addEventListener('pointerdown', onPointerDown)
  element?.addEventListener('pointermove', onPointerMove)
  element?.addEventListener('pointerup', onPointerUp)
  element?.addEventListener('pointercancel', onPointerCancel)
  element?.addEventListener('lostpointercapture', onPointerCancel)
  // 页面提供共享偏好时不注册第二个监听器；独立挂载仍安全响应系统设置。
  const media = sharedReducedMotion ? undefined : window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const updateMotion = () => { if (!sharedReducedMotion) reducedMotion.value = Boolean(media?.matches) }
  updateMotion()
  media?.addEventListener?.('change', updateMotion)
  const keydown = (event: KeyboardEvent) => {
    if (!enabled.value || event.altKey || event.ctrlKey || event.metaKey) return
    const target = event.target as HTMLElement | null
    if (target?.isContentEditable || target?.closest?.('button, uni-button, input, textarea, select, [contenteditable], [role="button"]')) return
    const directions: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    if (!event.repeat) slide(direction)
  }
  window.addEventListener('keydown', keydown)
  disposeKeyboard = () => {
    window.removeEventListener('keydown', keydown)
    element?.removeEventListener('pointerdown', onPointerDown)
    element?.removeEventListener('pointermove', onPointerMove)
    element?.removeEventListener('pointerup', onPointerUp)
    element?.removeEventListener('pointercancel', onPointerCancel)
    element?.removeEventListener('lostpointercapture', onPointerCancel)
    media?.removeEventListener?.('change', updateMotion)
  }
  // #endif
})
onUnmounted(() => {
  clearEffects(false)
  disposeKeyboard?.()
  onTouchCancel()
})
</script>

<template>
  <view class="board-wrap">
    <view ref="boardElement" class="board" :class="{ 'board-paused': !enabled, 'board-reduced': reducedMotion }"
      role="grid" aria-label="四乘四战斗棋盘，向上下左右滑动合并相同数字"
      @touchstart="onTouchStart" @touchmove.stop.prevent="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchCancel">
      <view class="board-square">
        <view class="board-background" aria-hidden="true">
          <view v-for="i in 16" :key="`slot-${i}`" class="board-slot"><view class="board-empty" /></view>
        </view>
        <view v-if="echoes.length" class="board-echoes" aria-hidden="true">
          <view v-for="echo in echoes" :key="echo.key" class="board-echo" :class="`board-echo-${echo.index}`" :style="echoStyle(echo)" />
        </view>
        <view class="board-tiles">
          <view v-for="tile in tiles" :key="tile.cell.id" class="board-tile"
            :class="{ 'board-tile-leaving': tile.leaving }" :style="position(tile)" :aria-hidden="tile.leaving ? 'true' : undefined">
            <Tile v-if="!tile.pending" :cell="tile.cell" :reduced-motion="reducedMotion" :presentation="tile.leaving" :impact="impactFor(tile)" />
          </view>
        </view>
      </view>
      <view v-if="edgeKey" :key="edgeKey" class="board-edge-flash" aria-hidden="true" />
    </view>
    <view v-if="attackFloat" :key="attackFloat.key" class="board-attack-float" aria-hidden="true">
      <text>攻击 +{{ attackFloat.value }}</text>
    </view>
    <text class="board-hint">拖动合并相同数字</text>
    <!-- #ifdef H5 -->
    <text class="board-keyboard-hint">鼠标按住拖动，或使用方向键</text>
    <!-- #endif -->
  </view>
</template>

<style scoped lang="scss">
.board-wrap { position: relative; width: 100%; max-width: 660rpx; margin: 0 auto; overflow: visible; }
.board { position: relative; width: 100%; box-sizing: border-box; padding: 10rpx; border: 2rpx solid var(--line); border-radius: 22rpx; background: var(--surface-raised); box-shadow: inset 0 2rpx 0 var(--accent-soft), var(--shadow); touch-action: none; user-select: none; -webkit-user-select: none; }
.board-square { position: relative; width: 100%; height: 0; padding-bottom: 100%; }
.board-background, .board-tiles, .board-echoes { position: absolute; inset: 0; }
.board-background { display: flex; flex-wrap: wrap; }
.board-slot, .board-tile, .board-echo { width: 25%; height: 25%; box-sizing: border-box; padding: 6rpx; }
.board-empty { width: 100%; height: 100%; background: var(--surface-soft); border: 1px solid var(--line); border-radius: 12rpx; box-sizing: border-box; box-shadow: inset 0 3rpx 8rpx rgba(0, 0, 0, 0.08); }
.board-tile { position: absolute; left: 0; top: 0; z-index: 2; transition: transform 150ms cubic-bezier(0.2, 0.65, 0.3, 1); }
.board-tile-leaving { z-index: 3; pointer-events: none; }
.board-tiles { z-index: 2; }
.board-echoes { z-index: 1; overflow: hidden; pointer-events: none; }
.board-echo { position: absolute; left: 0; top: 0; pointer-events: none; border: 6rpx solid transparent; border-radius: 18rpx; background: var(--zbfx-face); background-clip: padding-box; animation: zbfx-board-trail 150ms cubic-bezier(0.2, 0.65, 0.3, 1) both; }
.board-echo-1 { animation-name: zbfx-board-trail-far; }
.board-edge-flash { position: absolute; inset: -2rpx; border: 3rpx solid var(--accent); border-radius: 22rpx; box-shadow: inset 0 0 0 2rpx var(--accent-soft); pointer-events: none; opacity: 0; animation: zbfx-board-edge 230ms ease-out both; }
.board-attack-float { position: absolute; z-index: 6; left: 50%; top: -6rpx; transform: translate(-50%, 0); padding: 5rpx 16rpx; border: 1px solid var(--accent); border-radius: 999rpx; background: var(--surface-raised); color: var(--accent); font-size: 28rpx; font-weight: 900; line-height: 1.2; white-space: nowrap; pointer-events: none; animation: zbfx-board-attack 650ms ease-out both; }
.board-paused { border-color: var(--accent); }
.board-hint, .board-keyboard-hint { display: block; text-align: center; color: var(--muted); font-size: 26rpx; margin-top: 16rpx; }
.board-keyboard-hint { font-size: 24rpx; margin-top: 2rpx; }
.board-reduced .board-tile { transition: none; }
/* 拖尾与边框闪光是纯装饰；攻击浮字是数值反馈，减少动态时改为静态显示。 */
.board-reduced .board-echo, .board-reduced .board-edge-flash { display: none; animation: none; }
.board-reduced .board-attack-float { animation: none; opacity: 1; }
@keyframes zbfx-board-trail {
  0% { transform: var(--zbfx-from); opacity: 0; }
  22% { opacity: 0.32; }
  72% { opacity: 0.2; }
  100% { transform: var(--zbfx-to); opacity: 0; }
}
@keyframes zbfx-board-trail-far {
  0% { transform: var(--zbfx-from); opacity: 0; }
  22% { opacity: 0.17; }
  72% { opacity: 0.09; }
  100% { transform: var(--zbfx-to); opacity: 0; }
}
@keyframes zbfx-board-edge {
  0% { opacity: 0.85; }
  30% { opacity: 0.5; }
  100% { opacity: 0; }
}
@keyframes zbfx-board-attack {
  0% { transform: translate(-50%, 0) scale(0.9); opacity: 0; }
  12% { transform: translate(-50%, -10rpx) scale(1.04); opacity: 1; }
  65% { transform: translate(-50%, -18rpx) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -30rpx) scale(1); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .board-tile { transition: none; }
  .board-echo, .board-edge-flash { display: none; animation: none !important; }
  .board-attack-float { animation: none !important; opacity: 1; }
}
</style>
