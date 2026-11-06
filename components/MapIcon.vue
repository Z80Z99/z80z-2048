<script setup lang="ts">
import { computed } from 'vue'
import type { NodeType } from '../types'

const props = withDefaults(defineProps<{
  type: NodeType
  active?: boolean
  size?: 'normal' | 'large'
  dim?: boolean
}>(), {
  active: false,
  size: 'normal',
  dim: false
})

const src = computed(() => `/static/map-icons/${props.type}-${props.active ? 'gold' : 'ink'}.png`)
</script>

<template>
  <image
    class="map-icon"
    :class="{ 'map-icon--large': size === 'large', 'map-icon--dim': dim }"
    :src="src"
    mode="aspectFit"
    aria-hidden="true"
    role="presentation"
  />
</template>

<style scoped>
.map-icon {
  display: block;
  width: 64rpx;
  height: 64rpx;
  flex-shrink: 0;
  pointer-events: none;
}
.map-icon--large {
  width: 112rpx;
  height: 112rpx;
}
.map-icon--dim {
  opacity: 0.38;
}
</style>
