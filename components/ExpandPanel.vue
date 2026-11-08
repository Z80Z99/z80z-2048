<template>
  <view
    class="expand-panel"
    :class="{ 'expand-panel-closed': !mounted, 'expand-panel-closing': closing }"
    :data-motion-id="motionId"
    :style="panelStyle"
    @transitionend="onTransitionEnd"
  >
    <view v-if="mounted" class="expand-content" :style="contentStyle">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, inject, nextTick, onScopeDispose, ref, toRef, watch } from 'vue'
import type { Ref } from 'vue'
import { usePanelMotion } from '../composables/usePanelMotion'
import { panelMotionDuration } from '../utils/panelMotion'
import type { MotionTransitionEvent } from '../utils/panelMotion'

const props = withDefaults(defineProps<{
  open: boolean
  revision?: string | number
  reduced?: boolean
  duration?: number
}>(), { reduced: undefined, duration: 200 })

const instance = getCurrentInstance()
const inheritedReduced = inject<Ref<boolean>>('motionReduced', ref(false))
const reduced = computed(() => props.reduced ?? inheritedReduced.value)
const motion = usePanelMotion(reduced, toRef(props, 'duration'))
const { mounted, closing, revision: motionRevision } = motion
const motionId = `expand-${instance?.uid ?? 0}`
const height = ref(0)
const opacity = ref(0)
const durationMs = computed(() => reduced.value ? 0 : panelMotionDuration(props.duration))
const panelStyle = computed(() => ({ height: `${height.value}px`, transitionDuration: `${durationMs.value}ms` }))
const contentStyle = computed(() => ({ opacity: opacity.value, transitionDuration: `${durationMs.value}ms` }))
let measureGeneration = 0
let disposed = false

function canMeasure(generation: number) {
  return !disposed && props.open && mounted.value && generation === measureGeneration
}

async function measure(generation: number, attempt = 0) {
  await nextTick()
  if (!canMeasure(generation)) return
  let delivered = false
  function receive(result: { height?: number } | null) {
    if (delivered) return
    delivered = true
    if (!canMeasure(generation)) return
    const value = result?.height
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      // 0 是合法空内容；流式包装自身包含子元素外边距和边框。
      height.value = value
      opacity.value = 1
    } else if (attempt === 0) {
      // 首次原生布局未就绪时最多再测一次，不轮询页面。
      void measure(generation, 1)
    }
  }
  try {
    // H5 也交给 uni；proxy 同时兼容 H5 的 $el 和小程序组件作用域。
    const scope = instance?.proxy
    if (!scope || typeof uni === 'undefined' || typeof uni.createSelectorQuery !== 'function') {
      receive(null)
      return
    }
    const query = uni.createSelectorQuery().in(scope)
    query.select('.expand-content').boundingClientRect(receive)
    query.exec()
  } catch {
    receive(null)
  }
}

function refresh() {
  const generation = ++measureGeneration
  if (props.open && mounted.value && !disposed) void measure(generation)
}

watch(() => props.open, open => {
  if (open) {
    motion.open()
    refresh()
  } else {
    ++measureGeneration
    height.value = 0
    opacity.value = 0
    motion.close()
  }
}, { immediate: true, flush: 'sync' })

// 嵌套面板、异步内容等尺寸变化由父级显式 revision / refresh 通知。
watch([() => props.revision, () => props.duration, reduced], refresh, { flush: 'sync' })
watch(mounted, value => {
  if (!value) {
    ++measureGeneration
    height.value = 0
    opacity.value = 0
  }
}, { flush: 'sync' })

function onTransitionEnd(event: MotionTransitionEvent) {
  // 内层 opacity 或插槽动画的冒泡结束事件不能提前移除内容。
  motion.onTransitionEnd(event, motionRevision.value, 'height')
}

onScopeDispose(() => {
  disposed = true
  ++measureGeneration
})

defineExpose({ refresh })
</script>

<style scoped>
.expand-panel {
  min-height: 0;
  overflow: hidden;
  transition-property: height;
  transition-timing-function: ease;
}
.expand-panel-closed {
  height: 0;
  visibility: hidden;
}
.expand-content {
  display: flow-root;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  overflow: hidden;
  transition-property: opacity;
  transition-timing-function: ease;
}
.expand-panel-closing .expand-content {
  pointer-events: none;
}
</style>
