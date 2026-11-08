import { computed, onScopeDispose, shallowRef, unref, watch } from 'vue'
import type { Ref } from 'vue'
import { createPanelMotion, isOwnMotionTransition } from '../utils/panelMotion'
import type { MotionTransitionEvent } from '../utils/panelMotion'

export function usePanelMotion(reduced: Ref<boolean>, duration: number | Ref<number> = 200) {
  const controller = createPanelMotion({
    duration: () => unref(duration),
    reduced: () => reduced.value,
    onChange: state => { snapshot.value = state },
  })
  const snapshot = shallowRef(controller.snapshot)
  const mounted = computed(() => snapshot.value.mounted)
  const closing = computed(() => snapshot.value.phase === 'closing')
  const phase = computed(() => snapshot.value.phase)
  const revision = computed(() => snapshot.value.revision)

  watch([reduced, () => unref(duration)], () => controller.sync(), { flush: 'sync' })
  onScopeDispose(() => {
    controller.dispose()
    snapshot.value = controller.snapshot
  })

  function onTransitionEnd(event: MotionTransitionEvent, generation = revision.value, property = 'opacity') {
    if (isOwnMotionTransition(event, property)) controller.finish(generation)
  }

  return {
    mounted, closing, phase, revision,
    open: controller.show,
    show: controller.show,
    close: controller.close,
    reset: controller.reset,
    onTransitionEnd,
  }
}

// 关闭后 mounted 才变 false；调用方需在 closing 时拦截按钮动作并保留遮罩。
export function useModalMotion(reduced: Ref<boolean>, duration: number | Ref<number> = 180) {
  return usePanelMotion(reduced, duration)
}
