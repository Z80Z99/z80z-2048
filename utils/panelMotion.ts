export type PanelMotionPhase = 'closed' | 'opening' | 'open' | 'closing'

export interface PanelMotionSnapshot {
  readonly mounted: boolean
  readonly phase: PanelMotionPhase
  readonly revision: number
}

export interface PanelMotionOptions {
  duration?: number | (() => number)
  reduced?: () => boolean
  schedule?: (callback: () => void, delay: number) => unknown
  cancel?: (handle: unknown) => void
  onChange?: (snapshot: PanelMotionSnapshot) => void
}

export function panelMotionDuration(duration: number, fallback = 200) {
  return Number.isFinite(duration) ? Math.max(0, duration) : fallback
}

// 只管理展示生命周期，定时器不得触发游戏动作。
export function createPanelMotion(options: PanelMotionOptions = {}) {
  const schedule = options.schedule ?? ((callback, delay) => setTimeout(callback, delay))
  const cancel = options.cancel ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>))
  let state: PanelMotionSnapshot = Object.freeze({ mounted: false, phase: 'closed', revision: 0 })
  let timer: unknown
  let disposed = false

  function clearTimer() {
    if (timer !== undefined) cancel(timer)
    timer = undefined
  }

  function publish(phase: PanelMotionPhase, revision = state.revision) {
    state = Object.freeze({ mounted: phase !== 'closed', phase, revision })
    options.onChange?.(state)
  }

  function finish(revision: number) {
    if (disposed || revision !== state.revision) return
    if (state.phase !== 'opening' && state.phase !== 'closing') return
    clearTimer()
    publish(state.phase === 'closing' ? 'closed' : 'open')
  }

  function arm(revision: number) {
    if (disposed || revision !== state.revision) return
    if (state.phase !== 'opening' && state.phase !== 'closing') return
    const value = typeof options.duration === 'function' ? options.duration() : options.duration ?? 200
    const duration = panelMotionDuration(value)
    if (options.reduced?.() || duration === 0) {
      finish(revision)
      return
    }
    timer = schedule(() => {
      // 旧回调连当前定时器句柄也不能改动。
      if (disposed || revision !== state.revision) return
      timer = undefined
      finish(revision)
    }, duration)
  }

  function begin(phase: 'opening' | 'closing') {
    clearTimer()
    const revision = state.revision + 1
    publish(phase, revision)
    arm(revision)
  }

  function show() {
    if (disposed || state.phase === 'opening' || state.phase === 'open') return
    begin('opening')
  }

  function close() {
    if (disposed || state.phase === 'closed' || state.phase === 'closing') return
    begin('closing')
  }

  function reset() {
    if (disposed) return
    clearTimer()
    publish('closed', state.revision + 1)
  }

  // reduced / duration 变化由使用方通知；旧代次立即失效。
  function sync() {
    if (disposed || (state.phase !== 'opening' && state.phase !== 'closing')) return
    begin(state.phase)
  }

  function dispose() {
    if (disposed) return
    disposed = true
    clearTimer()
    state = Object.freeze({ mounted: false, phase: 'closed', revision: state.revision + 1 })
  }

  return { get snapshot() { return state }, show, close, reset, finish, sync, dispose }
}

type MotionTarget = { id?: string; dataset?: { motionId?: string } }
export interface MotionTransitionEvent {
  target?: MotionTarget | null
  currentTarget?: MotionTarget | null
  propertyName?: string
  detail?: { propertyName?: string }
}

// 小程序 target/currentTarget 可能是不同对象；没有稳定标识时保守走定时兜底。
export function isOwnMotionTransition(event: MotionTransitionEvent, property?: string) {
  const target = event.target
  const current = event.currentTarget
  if (!target || !current) return false
  const id = current.dataset?.motionId || current.id
  const own = target === current || (!!id && (target.dataset?.motionId || target.id) === id)
  const name = event.propertyName ?? event.detail?.propertyName
  return own && (!property || name === property)
}
