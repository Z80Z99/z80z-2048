export interface FeedbackState { text: string; revision: number }
export interface FeedbackScheduler { schedule(callback: () => void, delay: number): unknown; cancel(timer: unknown): void }

export function createFeedbackController(
  onChange: (state: FeedbackState) => void,
  scheduler: FeedbackScheduler = { schedule: (callback, delay) => setTimeout(callback, delay), cancel: timer => clearTimeout(timer as ReturnType<typeof setTimeout>) },
  duration = 1500,
) {
  let state: FeedbackState = { text: '', revision: 0 }
  let timer: unknown
  let disposed = false
  function clear() {
    if (timer !== undefined) scheduler.cancel(timer)
    timer = undefined
    state = { text: '', revision: state.revision + 1 }
    if (!disposed) onChange({ ...state })
  }
  function show(text: string) {
    if (disposed) return
    if (timer !== undefined) scheduler.cancel(timer)
    state = { text, revision: state.revision + 1 }
    onChange({ ...state })
    const revision = state.revision
    timer = scheduler.schedule(() => {
      if (!disposed && state.revision === revision) clear()
    }, duration)
  }
  function dispose() { clear(); disposed = true }
  return { show, clear, dispose, getState: () => ({ ...state }) }
}

export function formatChange(before: number, after: number): string | null {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before === after) return null
  const delta = Number((after - before).toFixed(2))
  return delta ? `${delta > 0 ? '+' : '−'}${Math.abs(delta)}` : null
}
