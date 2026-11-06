<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { Cell, Direction } from '../types'
import { useGameStore } from '../store/gameStore'
import { useSwipe } from '../composables/useSwipe'
import Tile from './Tile.vue'

interface PositionedTile {
  cell: Cell
  row: number
  col: number
  pending: boolean
  leaving: boolean
}

const MOVE_MS = 150
const store = useGameStore()
const inputBlocked = inject<Ref<boolean>>('gameInputBlocked', ref(false))
const grid = computed(() => store.battle?.grid ?? [])
const tiles = ref<PositionedTile[]>([])
const moving = ref(false)
const reducedMotion = ref(false)
const enabled = computed(() => store.screen === 'battle' && store.battle?.phase === 'playing' && !inputBlocked.value)
let previous: PositionedTile[] = []
let moveTimer: ReturnType<typeof setTimeout> | undefined

function snapshot(cells: Cell[][]): PositionedTile[] {
  const result: PositionedTile[] = []
  cells.forEach((row, r) => row.forEach((cell, c) => {
    if (cell.value > 0) result.push({ cell: { ...cell }, row: r, col: c, pending: false, leaving: false })
  }))
  return result
}

watch(grid, nextGrid => {
  if (moveTimer) clearTimeout(moveTimer)
  const next = snapshot(nextGrid)
  const oldById = new Map(previous.map(tile => [tile.cell.id, tile]))
  const shouldAnimate = previous.length > 0 && !reducedMotion.value
  const ghosts: PositionedTile[] = []

  for (const tile of next) {
    const newId = !oldById.has(tile.cell.id)
    tile.pending = shouldAnimate && newId && (tile.cell.isNew || tile.cell.isMerged)
    if (!shouldAnimate || !newId || !tile.cell.isMerged) continue
    for (const id of tile.cell.mergedFrom ?? []) {
      const source = oldById.get(id)
      if (!source) continue
      ghosts.push({
        ...source,
        cell: { ...source.cell, isNew: false, isMerged: false },
        row: tile.row,
        col: tile.col,
        pending: false,
        leaving: true,
      })
    }
  }

  tiles.value = [...next, ...ghosts]
  previous = next.map(tile => ({ ...tile, pending: false }))
  moving.value = shouldAnimate
  if (shouldAnimate) {
    moveTimer = setTimeout(() => {
      tiles.value = next.map(tile => ({ ...tile, pending: false }))
      moving.value = false
    }, MOVE_MS)
  }
}, { immediate: true })

function slide(direction: Direction) {
  if (enabled.value && !moving.value) store.SLIDE(direction)
}
const boardElement = ref<any>(null)
const { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } = useSwipe(slide, () => enabled.value && !moving.value)
watch(enabled, value => { if (!value) onTouchCancel() })

function position(tile: PositionedTile) {
  return { transform: `translate(${tile.col * 100}%, ${tile.row * 100}%)` }
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
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const updateMotion = () => { reducedMotion.value = Boolean(media?.matches) }
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
  if (moveTimer) clearTimeout(moveTimer)
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
        <view class="board-background">
          <view v-for="i in 16" :key="`slot-${i}`" class="board-slot"><view class="board-empty" /></view>
        </view>
        <view class="board-tiles">
          <view v-for="tile in tiles" :key="tile.cell.id" class="board-tile"
            :class="{ 'board-tile-leaving': tile.leaving }" :style="position(tile)">
            <Tile v-if="!tile.pending" :cell="tile.cell" :reduced-motion="reducedMotion" />
          </view>
        </view>
      </view>
    </view>
    <text class="board-hint">{{ enabled ? '滑动合并 · 空格越多，速度越快' : '回合结算中 · 棋盘已暂停' }}</text>
    <!-- #ifdef H5 -->
    <text class="board-keyboard-hint">鼠标按住拖动，或使用方向键</text>
    <!-- #endif -->
  </view>
</template>

<style scoped lang="scss">
.board-wrap { width: 100%; max-width: 660rpx; margin: 0 auto; }
.board { position: relative; width: 100%; box-sizing: border-box; padding: 10rpx; border: 2rpx solid var(--line); border-radius: 22rpx; background: var(--surface-raised); box-shadow: inset 0 2rpx 0 var(--accent-soft), var(--shadow); touch-action: none; user-select: none; -webkit-user-select: none; }
.board-square { position: relative; width: 100%; height: 0; padding-bottom: 100%; }
.board-background, .board-tiles { position: absolute; inset: 0; }
.board-background { display: flex; flex-wrap: wrap; }
.board-slot, .board-tile { width: 25%; height: 25%; box-sizing: border-box; padding: 6rpx; }
.board-empty { width: 100%; height: 100%; background: var(--surface-soft); border: 1px solid var(--line); border-radius: 12rpx; box-sizing: border-box; box-shadow: inset 0 3rpx 8rpx rgba(0, 0, 0, 0.08); }
.board-tile { position: absolute; left: 0; top: 0; z-index: 2; transition: transform var(--tile-time) cubic-bezier(0.2, 0.65, 0.3, 1); will-change: transform; }
.board-tile-leaving { z-index: 3; pointer-events: none; }
.board-paused { border-color: var(--accent); }
.board-hint, .board-keyboard-hint { display: block; text-align: center; color: var(--muted); font-size: 26rpx; margin-top: 16rpx; }
.board-keyboard-hint { font-size: 24rpx; margin-top: 2rpx; }
.board-reduced .board-tile { transition: none; }
@media (prefers-reduced-motion: reduce) { .board-tile { transition: none; will-change: auto; } }
</style>
