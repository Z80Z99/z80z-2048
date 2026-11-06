import type { Direction } from '../types'

const MIN_SWIPE_DISTANCE = 26

export function useSwipe(onSwipe: (dir: Direction) => void, enabled: () => boolean = () => true) {
  let startX = 0
  let startY = 0
  let active = false
  let touchId: number | undefined
  let pointerId: number | undefined

  function onTouchCancel() {
    active = false
    touchId = undefined
    pointerId = undefined
  }

  function finishSwipe(x: number, y: number) {
    const wasActive = active
    onTouchCancel()
    if (!wasActive || !enabled()) return
    const dx = x - startX
    const dy = y - startY
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
    if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN_SWIPE_DISTANCE) return
    onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
  }

  // 网页鼠标/触控笔使用 Pointer Events，触屏仍走原触摸事件，避免重复移动。
  function onPointerDown(event: any) {
    if (event.pointerType === 'touch') return
    onTouchCancel()
    if (!enabled() || event.button !== 0 || event.isPrimary === false) return
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return
    startX = event.clientX
    startY = event.clientY
    pointerId = event.pointerId
    active = true
    event.preventDefault?.()
    try { event.currentTarget?.setPointerCapture?.(event.pointerId) } catch { /* 已结束的指针无需捕获。 */ }
  }

  function onPointerMove(event: any) {
    if (pointerId !== undefined && event.pointerId === pointerId && !enabled()) onTouchCancel()
  }

  function onPointerUp(event: any) {
    if (pointerId === undefined || event.pointerId !== pointerId) return
    finishSwipe(event.clientX, event.clientY)
  }

  function onPointerCancel(event: any) {
    if (pointerId !== undefined && event.pointerId === pointerId) onTouchCancel()
  }

  function onTouchStart(event: any) {
    onTouchCancel()
    if (!enabled() || (event.touches?.length ?? 1) !== 1) return
    const touch = event.touches?.[0] ?? event.changedTouches?.[0]
    if (!touch) return
    startX = touch.clientX ?? touch.pageX ?? touch.x
    startY = touch.clientY ?? touch.pageY ?? touch.y
    if (!Number.isFinite(startX) || !Number.isFinite(startY)) return
    touchId = touch.identifier
    active = true
  }

  function onTouchMove(event: any) {
    if (!enabled() || (event.touches?.length ?? 1) > 1) onTouchCancel()
  }

  function onTouchEnd(event: any) {
    const touches = Array.from(event.changedTouches ?? []) as any[]
    const touch = touches.find(item => touchId === undefined || item.identifier === touchId)
    if (!touch) { onTouchCancel(); return }
    finishSwipe(touch.clientX ?? touch.pageX ?? touch.x, touch.clientY ?? touch.pageY ?? touch.y)
  }

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
