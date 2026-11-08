<script setup lang="ts">
import { ref } from 'vue'
import type { AttributeInfo } from '../utils/attributeInfo'
import ExpandPanel from './ExpandPanel.vue'
defineProps<{ info: AttributeInfo; closing?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const showCalculation = ref(false)
</script>

<template>
  <view class="ui-overlay attribute-overlay" :class="{ 'ui-motion-closing': closing }" @click="emit('close')">
    <view class="ui-dialog attribute-dialog" role="dialog" aria-modal="true" :aria-label="`${info.title}说明`" @click.stop>
      <view class="ui-sheet-header"><text class="ui-sheet-title">{{ info.title }}</text><button role="button" class="ui-close" :disabled="closing" @click="emit('close')">关闭</button></view>
      <text class="attribute-value">{{ info.value }}</text>
      <text class="attribute-summary">{{ info.summary }}</text>
      <view class="attribute-lines"><text v-for="line in info.details" :key="line">{{ line }}</text></view>
      <button v-if="info.calculation" role="button" class="attribute-calculation-toggle" :disabled="closing" :aria-expanded="showCalculation" @click="showCalculation = !showCalculation">怎么算 {{ showCalculation ? '−' : '+' }}</button>
      <ExpandPanel :open="showCalculation"><text class="attribute-calculation">{{ info.calculation }}</text></ExpandPanel>
    </view>
  </view>
</template>

<style scoped lang="scss">
.attribute-overlay { z-index: 150; }
.attribute-dialog { max-width: 660rpx; }
.attribute-value { display: block; font-size: 34rpx; font-weight: 800; color: var(--accent); margin-bottom: 12rpx; }
.attribute-summary { display: block; font-size: 30rpx; font-weight: 700; color: var(--text); line-height: 1.5; }
.attribute-lines { margin-top: 16rpx; display: flex; flex-direction: column; gap: 12rpx; }
.attribute-lines text, .attribute-calculation { display: block; color: var(--muted); font-size: 27rpx; line-height: 1.65; }
.attribute-calculation-toggle { margin: 20rpx 0 0; padding: 12rpx 18rpx; border: 1px solid var(--line); border-radius: 10rpx; background: var(--surface-soft); color: var(--accent); font-size: 27rpx; line-height: 1.5; }
.attribute-calculation-toggle::after { border: none; }
.attribute-calculation { margin-top: 16rpx; }
</style>
