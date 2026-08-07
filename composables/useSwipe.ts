import type { Direction } from '../types'

const MIN_SWIPE_DISTANCE = 30

export function useSwipe(onSwipe: (dir: Direction) => void) {
  let touchStartX = 0
  let touchStartY = 0
  let touchActive = false

  function onTouchStart(e: any) {
    const touch = e.touches?.[0] ?? e.changedTouches?.[0]
    if (!touch) return
    touchStartX = touch.clientX ?? touch.pageX ?? touch.x
    touchStartY = touch.clientY ?? touch.pageY ?? touch.y
    touchActive = true
  }

  function onTouchEnd(e: any) {
    if (!touchActive) return
    const touch = e.changedTouches?.[0] ?? e.touches?.[0]
    if (!touch) return

    const endX = touch.clientX ?? touch.pageX ?? touch.x
    const endY = touch.clientY ?? touch.pageY ?? touch.y

    const dx = endX - touchStartX
    const dy = endY - touchStartY
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (Math.max(absDx, absDy) < MIN_SWIPE_DISTANCE) return

    let dir: Direction
    if (absDx > absDy) {
      dir = dx > 0 ? 'right' : 'left'
    } else {
      dir = dy > 0 ? 'down' : 'up'
    }

    touchActive = false
    onSwipe(dir)
  }

  return { onTouchStart, onTouchEnd }
}
