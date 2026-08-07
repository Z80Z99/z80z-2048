<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '../../store/gameStore'
import BestiaryPanel from '../BestiaryPanel.vue'

const emit = defineEmits<{ (e: 'open-debug'): void }>()

const store = useGameStore()

const showBestiary = ref(false)
const tapCount = ref(0)
let tapTimer: any = null

function onTitleClick() {
  tapCount.value++
  if (tapCount.value >= 3) { tapCount.value = 0; emit('open-debug') }
  if (tapTimer) clearTimeout(tapTimer)
  tapTimer = setTimeout(() => { tapCount.value = 0 }, 1500)
}
</script>

<template>
  <view class="screen title-screen">
    <view class="title-area">
      <text class="title-main" @click="onTitleClick">Z80Z</text>
      <text class="title-sub">2048 Roguelike</text>
    </view>
    <view class="title-menu">
      <button class="menu-btn" @click="store.START_RUN()">开始冒险</button>
      <button class="menu-btn" @click="showBestiary = true">怪物图鉴</button>
      <button class="menu-btn menu-btn-secondary" @click="store.GO_TO_META_SHOP()">永久升级</button>
    </view>
    <BestiaryPanel v-if="showBestiary" @close="showBestiary = false" />
  </view>
</template>

<style lang="scss">
.title-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460); }
.title-area { text-align: center; margin-bottom: 60px; animation: title-fade 0.8s ease-out; }
.title-main { font-size: 64px; font-weight: bold; color: #f1c40f; display: block; letter-spacing: 8px; animation: title-glow 3s ease-in-out infinite; }
.title-sub { font-size: 16px; color: #888; margin-top: 8px; display: block; animation: title-fade 0.8s 0.2s ease-out both; }
.title-menu { display: flex; flex-direction: column; gap: 16px; width: 240px; }
.menu-btn { width: 100%; background: #f1c40f; color: #1a1a2e; border: none; border-radius: 8px; font-size: 18px; font-weight: bold; padding: 12px 0; transition: all 0.2s; animation: title-fade 0.6s ease-out both; }
.menu-btn:nth-child(1) { animation-delay: 0.3s; }
.menu-btn:nth-child(2) { animation-delay: 0.4s; }
.menu-btn:nth-child(3) { animation-delay: 0.5s; }
.menu-btn:active { transform: scale(0.95); filter: brightness(1.2); }
.menu-btn-secondary { background: transparent; color: #f1c40f; border: 2px solid #f1c40f; }
.menu-btn-secondary:active { background: rgba(241,196,15,0.1); }
</style>
