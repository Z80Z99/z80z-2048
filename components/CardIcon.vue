<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CardClass } from '../types'
import { cardArtwork, CARD_CLASS_SYMBOLS } from '../utils/artwork'
const props = withDefaults(defineProps<{ cardClass: CardClass; icon: string; size?: 'small' | 'normal' | 'large' }>(), { size: 'normal' })
const source = computed(() => cardArtwork(props.icon))
const failed = ref(false)
watch(source, () => { failed.value = false })
</script>

<template>
  <view class="card-icon card-tone" :class="[`card-${cardClass}`, `card-icon-${size}`]" aria-hidden="true">
    <image v-if="!failed" class="card-icon-image" :src="source" mode="aspectFit" @error="failed = true" />
    <text v-else class="card-icon-fallback">◇</text>
    <text class="card-icon-symbol">{{ CARD_CLASS_SYMBOLS[cardClass] }}</text>
  </view>
</template>

<style scoped lang="scss">
.card-icon { position: relative; display: flex; align-items: center; justify-content: center; width: 80rpx; height: 80rpx; flex-shrink: 0; box-sizing: border-box; border: 3rpx solid var(--card-color); border-radius: 12rpx 12rpx 5rpx 5rpx; background: var(--surface-raised); box-shadow: inset 0 0 0 4rpx var(--surface-soft); pointer-events: none; }
.card-icon-image { width: 86%; height: 86%; display: block; }
.card-icon-small { width: 48rpx; height: 48rpx; border-radius: 8rpx 8rpx 3rpx 3rpx; }
.card-icon-large { width: 112rpx; height: 112rpx; }
.card-icon-symbol { position: absolute; right: -6rpx; bottom: -6rpx; padding: 0 5rpx; background: var(--surface-soft); color: var(--card-label-color, var(--card-color)); font-size: 20rpx; font-weight: 800; line-height: 1.3; border: 1rpx solid var(--card-color); border-radius: 4rpx; }
.card-icon.card-black { background: var(--card-black); box-shadow: inset 0 0 0 3rpx var(--card-black); border-style: double; border-width: 5rpx; }
.card-icon-fallback { color: var(--card-label-color, var(--card-color)); font-size: 30rpx; }
</style>
