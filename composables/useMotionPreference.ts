import { inject, onScopeDispose, ref } from 'vue'
import type { Ref } from 'vue'

export function useMotionPreference(): Ref<boolean> {
  const shared = inject<Ref<boolean> | null>('motionReduced', null)
  if (shared) return shared
  const reduced = ref(false)
  // #ifdef H5
  if (typeof window !== 'undefined') {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const update = () => { reduced.value = Boolean(media?.matches) }
    update()
    media?.addEventListener?.('change', update)
    onScopeDispose(() => media?.removeEventListener?.('change', update))
  }
  // #endif
  return reduced
}
