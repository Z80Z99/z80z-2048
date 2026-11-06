<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EquipSlot } from '../core/equipment'
import type { UpgradeEffect, UpgradeRarity } from '../types'
import { equipmentArtwork, upgradeArtwork, setEmblem } from '../utils/artwork'

const props = withDefaults(defineProps<{
  slot?: EquipSlot
  setId?: string
  upgradeType?: UpgradeEffect['type']
  rarity?: UpgradeRarity
  size?: 'small' | 'normal' | 'large'
  showQuality?: boolean
}>(), { rarity: 'common', size: 'normal', showQuality: true })
const source = computed(() => props.upgradeType ? upgradeArtwork(props.upgradeType) : equipmentArtwork(props.slot))
const badge = computed(() => setEmblem(props.setId))
const imageFailed = ref(false)
const badgeFailed = ref(false)
watch(source, () => { imageFailed.value = false })
watch(badge, () => { badgeFailed.value = false })
const marks = { common: 'Ⅰ', rare: 'Ⅱ', epic: 'Ⅲ' }
</script>

<template>
  <view class="item-icon" :class="[`item-icon-${rarity}`, `item-icon-${size}`]" aria-hidden="true">
    <image v-if="!imageFailed" class="item-icon-image" :src="source" mode="aspectFit" @error="imageFailed = true" />
    <text v-else class="item-icon-fallback">◇</text>
    <view v-if="badge && !badgeFailed" class="item-icon-badge"><image :src="badge" mode="aspectFit" @error="badgeFailed = true" /></view>
    <text v-if="showQuality" class="item-icon-quality">{{ marks[rarity] }}</text>
  </view>
</template>

<style scoped lang="scss">
.item-icon { position: relative; display: flex; align-items: center; justify-content: center; width: 80rpx; height: 80rpx; flex-shrink: 0; box-sizing: border-box; border: 1rpx solid var(--line); border-radius: 12rpx 12rpx 5rpx 5rpx; background: var(--surface-raised); box-shadow: inset 0 0 0 4rpx var(--surface-soft); pointer-events: none; }
.item-icon-image { display: block; width: 86%; height: 86%; }
.item-icon-rare { border-color: var(--rarity-rare); border-style: double; border-width: 3rpx; }
.item-icon-epic { border-color: var(--rarity-epic); border-style: double; border-width: 4rpx; border-radius: 16rpx 16rpx 5rpx 5rpx; }
.item-icon-small { width: 48rpx; height: 48rpx; border-radius: 8rpx 8rpx 3rpx 3rpx; }
.item-icon-large { width: 112rpx; height: 112rpx; }
.item-icon-badge { position: absolute; right: -9rpx; bottom: -7rpx; width: 32rpx; height: 32rpx; display: flex; justify-content: center; align-items: center; background: var(--surface); border: 1rpx solid var(--line); border-radius: 50%; }
.item-icon-badge image { width: 90%; height: 90%; }
.item-icon-small .item-icon-badge { width: 24rpx; height: 24rpx; right: -6rpx; bottom: -5rpx; }
.item-icon-quality { position: absolute; left: 3rpx; bottom: -4rpx; padding: 0 4rpx; background: var(--surface-soft); color: var(--rarity-common); font-size: 16rpx; line-height: 1.2; font-weight: 800; }
.item-icon-rare .item-icon-quality { color: var(--rarity-rare); }
.item-icon-epic .item-icon-quality { color: var(--rarity-epic); }
.item-icon-fallback { font-size: 32rpx; color: var(--muted); }
</style>
