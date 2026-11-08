<script setup lang="ts">
import { ref, computed, watch, onUnmounted, inject } from 'vue'
import ExpandPanel from './ExpandPanel.vue'
import { useFeedback } from '../composables/useFeedback'
import { useMotionPreference } from '../composables/useMotionPreference'
import type { EnemyDef } from '../types'
import { getEnemyIcon, getEnemyFallbackIcon, getEnemyUpgradeDescription, getEnemyUpgradeName } from '../core/enemy'

const props = defineProps<{ enemy: EnemyDef; currentHp: number; attack: number; defense: number; speed: number; round: number; kind?: string }>()
const hpPercent = computed(() => Math.max(0, Math.min(100, props.currentHp / Math.max(1, props.enemy.maxHp) * 100)))
const portraitFailed = ref(false)
watch(() => props.enemy.id, () => { portraitFailed.value = false })
const portrait = computed(() => portraitFailed.value ? getEnemyFallbackIcon(props.enemy.id) : getEnemyIcon(props.enemy))
const portraitIsImage = computed(() => /^(\/|\.\/|data:image)/.test(portrait.value))
const rank = computed(() => props.kind === 'boss' || props.enemy.id.startsWith('boss_') ? '守关首领' : props.kind === 'elite' ? '精英敌人' : '遭遇敌人')
const traits = computed(() => (props.enemy.enemyUpgrades ?? []).map(id => ({ id, name: getEnemyUpgradeName(id) })))
const reduced = useMotionPreference()
const damageFeedback = useFeedback(600)
const showHelp = inject<((key: string) => void) | null>('show-attribute-help', null)
const explain = (key: string) => showHelp?.(key)
const showTraits = ref(false)
const hit = ref(false)
let hitTimer: ReturnType<typeof setTimeout> | undefined
watch(() => props.currentHp, (hp, oldHp) => {
  if (hp >= oldHp) return
  if (hitTimer) clearTimeout(hitTimer)
  damageFeedback.show(`−${oldHp - hp}`)
  if (reduced.value) return
  hit.value = true
  hitTimer = setTimeout(() => { hit.value = false }, 260)
})
onUnmounted(() => { if (hitTimer) clearTimeout(hitTimer) })
</script>

<template>
  <view class="enemy-card ui-card">
    <view class="enemy-body" :class="{ 'enemy-hit': hit }">
      <view class="enemy-header">
        <view class="enemy-portrait" :class="{ 'enemy-portrait-boss': rank === '守关首领' }">
          <image v-if="portraitIsImage" class="enemy-portrait-image" :src="portrait" mode="aspectFit" :aria-label="enemy.name" @error="portraitFailed = true" />
          <text v-else class="enemy-portrait-icon">{{ portrait }}</text>
        </view>
        <view class="enemy-identity">
          <view class="enemy-name-row">
            <text class="enemy-name">{{ enemy.name }}</text>
            <button role="button" class="enemy-traits-toggle" :aria-expanded="showTraits" aria-controls="enemy-stat-details" @click="showTraits = !showTraits">{{ traits.length ? `能力 ${traits.length}` : '详情' }} {{ showTraits ? '−' : '+' }}</button>
          </view>
          <view class="enemy-hp-row" role="button" aria-label="查看敌人生命说明" @click="explain('enemy.hp')"><text class="enemy-rank">{{ rank }}</text><text class="enemy-hp-num">生命 {{ currentHp }} / {{ enemy.maxHp }}</text></view>
          <view class="enemy-hp-track"><view class="enemy-hp-fill" :style="{ width: `${hpPercent}%` }" /></view>
        </view>
      </view>
      <view class="enemy-stats">
        <view class="enemy-stat" role="button" aria-label="查看敌人攻击说明" @click="explain('enemy.attack')"><text class="enemy-stat-label">攻击</text><text class="enemy-stat-value stat-attack">{{ attack }}</text></view>
        <view class="enemy-stat" role="button" aria-label="查看敌人防御说明" @click="explain('enemy.defense')"><text class="enemy-stat-label">防御</text><text class="enemy-stat-value stat-defense">{{ defense }}</text></view>
        <view class="enemy-stat" role="button" aria-label="查看敌人速度说明" @click="explain('enemy.speed')"><text class="enemy-stat-label">速度</text><text class="enemy-stat-value stat-speed">{{ speed }}</text></view>
      </view>
      <ExpandPanel :open="showTraits" :revision="round"><view id="enemy-stat-details" class="enemy-traits">
        <text class="enemy-growth">当前数值已包含第 {{ round }} 回合的成长和削弱；防御已扣除你的穿透效果。</text>
        <text v-if="!traits.length" class="enemy-growth">该敌人没有额外强化能力。</text>
        <view v-for="trait in traits" :key="trait.id" class="enemy-trait"><text class="enemy-trait-name">{{ trait.name }}</text><text class="enemy-trait-desc">{{ getEnemyUpgradeDescription(trait.id) }}</text></view>
      </view></ExpandPanel>
      <text v-if="damageFeedback.text.value" :key="damageFeedback.revision.value" class="enemy-damage-float ui-feedback" role="status">{{ damageFeedback.text.value }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.enemy-card { position: relative; padding: 12rpx 16rpx; margin-bottom: 12rpx; border-left: 4rpx solid var(--attack); }
.enemy-header { display: flex; align-items: center; gap: 14rpx; }
.enemy-portrait { display: flex; align-items: center; justify-content: center; width: 76rpx; height: 86rpx; flex-shrink: 0; box-sizing: border-box; border: 1px solid var(--line); border-radius: 30rpx 30rpx 10rpx 10rpx; background: var(--surface-raised); box-shadow: inset 0 0 0 5rpx var(--surface-soft); }
.enemy-portrait-boss { border-color: var(--accent); background: var(--accent-soft); }
.enemy-portrait-image { width: 70rpx; height: 76rpx; }
.enemy-portrait-icon { font-size: 44rpx; line-height: 1; }
.enemy-identity { flex: 1; min-width: 0; }
.enemy-name-row { display: flex; align-items: center; justify-content: space-between; gap: 10rpx; margin-bottom: 2rpx; }
.enemy-name { flex: 1; min-width: 0; font-size: 30rpx; color: var(--text); font-weight: 800; line-height: 1.25; overflow-wrap: anywhere; }
.enemy-rank { color: var(--attack); font-size: 22rpx; line-height: 1.4; }
.enemy-hp-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8rpx; flex-wrap: wrap; margin-bottom: 5rpx; }
.enemy-hp-num { font-size: 24rpx; line-height: 1.3; color: var(--text); font-weight: 700; }
.enemy-hp-track { height: 8rpx; border-radius: 4rpx; background: var(--track); overflow: hidden; }
.enemy-hp-fill { height: 100%; background: var(--attack); transition: width 250ms ease; }
.enemy-stats { display: flex; gap: 10rpx; margin-top: 8rpx; }
.enemy-stat { flex: 1; display: flex; align-items: baseline; justify-content: center; gap: 8rpx; padding: 3rpx 0; background: var(--surface-soft); border-radius: 8rpx; }
.enemy-stat-label { font-size: 24rpx; line-height: 1.3; color: var(--muted); }
.enemy-stat-value { font-size: 28rpx; line-height: 1.3; font-weight: 800; }
.enemy-growth { display: block; font-size: 26rpx; line-height: 1.6; color: var(--muted); margin: 8rpx 0; }
.enemy-traits-toggle { flex-shrink: 0; box-sizing: border-box; min-height: 46rpx; padding: 7rpx 10rpx; margin: 0; background: var(--accent-soft); color: var(--accent); border-radius: 8rpx; font-size: 24rpx; line-height: 1.3; white-space: nowrap; }
.enemy-traits-toggle::after { border: none; }
.enemy-traits { border-top: 1px solid var(--line); margin-top: 12rpx; padding-top: 12rpx; }
.enemy-trait { margin: 10rpx 0; }
.enemy-trait-name { color: var(--xp); font-weight: 700; font-size: 26rpx; margin-right: 12rpx; }
.enemy-trait-desc { color: var(--muted); font-size: 26rpx; line-height: 1.6; }
.enemy-body { position: relative; }
.enemy-damage-float { position: absolute; left: 22rpx; top: 0; padding: 4rpx 8rpx; background: var(--surface); color: var(--attack); border-radius: 7rpx; font-size: 25rpx; font-weight: 800; pointer-events: none; }
.enemy-hit { animation: enemy-hit 260ms ease-out; }
@media (prefers-reduced-motion: reduce) { .enemy-hit { animation: none; } .enemy-hp-fill { transition: none; } }
</style>
