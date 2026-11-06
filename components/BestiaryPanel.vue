<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../store/gameStore'
import { ENEMIES, getEnemyIcon, getEnemyFallbackIcon } from '../core/enemy'
import type { EnemyDef } from '../types'

const emit = defineEmits<{ close: [] }>()
const store = useGameStore()
const discoveredOnly = ref(false)
const failedPortraits = ref<Record<string, boolean>>({})
const meta = computed(() => store.meta)
const found = computed(() => ENEMIES.filter(enemy => meta.value.unlockedEnemies.includes(enemy.id)).length)
const milestones = computed(() => Object.values(meta.value.enemyKills).reduce((sum, kills) => sum + Math.floor(kills / 5), 0))
const nextGlobal = computed(() => (meta.value.globalClaimLevel + 1) * 20)
const canClaimGlobal = computed(() => milestones.value >= nextGlobal.value)
const groups = computed(() => {
  const list = discoveredOnly.value ? ENEMIES.filter(enemy => unlocked(enemy.id)) : ENEMIES
  const groupDefs = [
    { name: '地牢入口', filter: (enemy: EnemyDef) => enemy.tier === 1 },
    { name: '深渊回廊', filter: (enemy: EnemyDef) => enemy.tier === 2 },
    { name: '终焉之间', filter: (enemy: EnemyDef) => enemy.tier === 3 },
    { name: '守关首领', filter: (enemy: EnemyDef) => enemy.id.startsWith('boss_') },
    { name: '无尽生物', filter: (enemy: EnemyDef) => enemy.tier >= 4 && !enemy.id.startsWith('boss_') },
  ]
  return groupDefs.map(group => ({ name: group.name, enemies: list.filter(group.filter) })).filter(group => group.enemies.length)
})
function unlocked(id: string) { return meta.value.unlockedEnemies.includes(id) }
function kills(id: string) { return meta.value.enemyKills[id] ?? 0 }
function goal(id: string) { return ((meta.value.enemyClaims[id] ?? 0) + 1) * 5 }
function claimable(id: string) { return kills(id) >= goal(id) }
function progress(id: string) { return Math.min(100, Math.max(0, (kills(id) - (meta.value.enemyClaims[id] ?? 0) * 5) / 5 * 100)) }
function portrait(enemy: EnemyDef) { return failedPortraits.value[enemy.id] ? getEnemyFallbackIcon(enemy.id) : getEnemyIcon(enemy) }
function imageIcon(enemy: EnemyDef) { return /^(\/|\.\/|data:image)/.test(portrait(enemy)) }
</script>

<template>
  <view class="ui-overlay ui-sheet-overlay bestiary-overlay" @click="emit('close')"><view class="ui-sheet bestiary-panel" @click.stop>
    <view class="ui-sheet-header"><view><text class="ui-kicker">地牢生物志 · {{ found }}/{{ ENEMIES.length }}</text><text class="ui-sheet-title">记录每一场相遇</text></view><button role="button" class="ui-close" @click="emit('close')">关闭</button></view>
    <view class="bestiary-global"><view class="bestiary-global-row"><view><text class="bestiary-global-title">探索里程碑 {{ milestones }} / {{ nextGlobal }}</text><text class="ui-note">下一奖励：10 碎片 · 永久生命 +3</text></view><button role="button" class="bestiary-claim" :disabled="!canClaimGlobal" @click="store.CLAIM_BESTIARY_REWARD('global')">{{ canClaimGlobal ? '领取' : '未达成' }}</button></view><view class="bestiary-progress"><view :style="{ width: `${Math.min(100, milestones / nextGlobal * 100)}%` }" /></view></view>
    <view class="bestiary-filter"><text class="ui-note">每 5 次击杀 = 1 个里程碑</text><button role="button" @click="discoveredOnly = !discoveredOnly">{{ discoveredOnly ? '显示全部' : '只看已发现' }}</button></view>
    <scroll-view class="ui-scroll" scroll-y>
      <text v-if="!groups.length" class="ui-note bestiary-empty">还没有发现的生物。开始冒险，击败你的第一个敌人。</text>
      <view v-for="group in groups" :key="group.name" class="bestiary-group"><text class="bestiary-group-title">{{ group.name }}</text>
        <view v-for="enemy in group.enemies" :key="enemy.id" class="bestiary-card" :class="{ 'bestiary-locked': !unlocked(enemy.id) }">
          <view class="bestiary-card-main"><view class="bestiary-portrait"><template v-if="unlocked(enemy.id)"><image v-if="imageIcon(enemy)" class="bestiary-image" :src="portrait(enemy)" mode="aspectFit" @error="failedPortraits[enemy.id] = true" /><text v-else>{{ portrait(enemy) }}</text></template><text v-else>?</text></view><view class="bestiary-identity"><text class="bestiary-name">{{ unlocked(enemy.id) ? enemy.name : '未发现的生物' }}</text><view v-if="unlocked(enemy.id)" class="bestiary-stats"><text class="stat-hp">生命 {{ enemy.maxHp }}</text><text class="stat-attack">攻击 {{ enemy.attack }}</text><text class="stat-defense">防御 {{ enemy.defense }}</text><text class="stat-speed">速度 {{ enemy.speed }}</text></view><text v-else class="ui-note">击败后解锁记录</text></view></view>
          <view v-if="unlocked(enemy.id)" class="bestiary-card-footer"><view class="bestiary-kills"><text>{{ kills(enemy.id) }} / {{ goal(enemy.id) }} 次击杀</text><view class="bestiary-progress"><view :style="{ width: `${progress(enemy.id)}%` }" /></view></view><button role="button" class="bestiary-claim" :disabled="!claimable(enemy.id)" @click="store.CLAIM_BESTIARY_REWARD('enemy', enemy.id)">{{ claimable(enemy.id) ? '领取 3 碎片' : '再遇，再战' }}</button></view>
        </view>
      </view>
      <text class="bestiary-footnote">图鉴记录基础属性。实际战斗还受阶段、回合成长与强化影响。</text>
    </scroll-view>
  </view></view>
</template>

<style scoped lang="scss">
.bestiary-overlay { z-index: 120; }
.bestiary-global { padding: 20rpx; background: var(--accent-soft); border: 1px solid var(--line); border-radius: 16rpx; margin-bottom: 14rpx; }
.bestiary-global-row { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-bottom: 14rpx; }
.bestiary-global-title { display: block; color: var(--text); font-size: 28rpx; font-weight: 700; margin-bottom: 4rpx; }
.bestiary-claim { flex-shrink: 0; margin: 0; padding: 14rpx 18rpx; border: 1px solid var(--line); border-radius: 10rpx; color: var(--gold); background: var(--gold-soft); font-size: 26rpx; line-height: 1.4; }
.bestiary-claim::after { border: none; }
.bestiary-claim[disabled] { color: var(--muted); background: var(--surface-soft); }
.bestiary-progress { height: 7rpx; background: var(--track); border-radius: 3rpx; overflow: hidden; }
.bestiary-progress view { height: 100%; background: var(--gold); }
.bestiary-filter { display: flex; justify-content: space-between; align-items: center; gap: 10rpx; margin: 4rpx 0 12rpx; }
.bestiary-filter button { margin: 0; padding: 12rpx 8rpx; background: none; font-size: 26rpx; line-height: 1.4; color: var(--accent); }
.bestiary-filter button::after { border: none; }
.bestiary-group { margin-bottom: 26rpx; }
.bestiary-group-title { display: block; color: var(--accent); font-size: 28rpx; font-weight: 700; margin: 8rpx 0 16rpx; }
.bestiary-card { border: 1px solid var(--line); border-radius: 14rpx; padding: 20rpx; background: var(--surface-soft); margin-bottom: 14rpx; }
.bestiary-card-main { display: flex; align-items: center; gap: 18rpx; }
.bestiary-portrait { width: 82rpx; height: 92rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--surface-raised); border: 1px solid var(--line); border-radius: 40rpx 40rpx 12rpx 12rpx; font-size: 46rpx; color: var(--muted); }
.bestiary-image { width: 76rpx; height: 84rpx; }
.bestiary-identity { flex: 1; min-width: 0; }
.bestiary-name { display: block; font-size: 30rpx; font-weight: 800; line-height: 1.4; color: var(--text); margin-bottom: 10rpx; }
.bestiary-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6rpx 14rpx; font-size: 24rpx; }
.bestiary-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; margin-top: 18rpx; padding-top: 16rpx; border-top: 1px solid var(--line); }
.bestiary-kills { flex: 1; min-width: 0; color: var(--muted); font-size: 24rpx; }
.bestiary-kills .bestiary-progress { margin-top: 8rpx; }
.bestiary-locked { border-style: dashed; }
.bestiary-locked .bestiary-name { color: var(--muted); font-weight: 500; }
.bestiary-footnote { display: block; color: var(--muted); font-size: 26rpx; line-height: 1.7; margin: 26rpx 0 36rpx; }
.bestiary-empty { padding: 36rpx 0; text-align: center; }
</style>
