<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '../store/gameStore'
import { UPGRADE_POOL } from '../core/upgrade'
import { ALL_EQUIPMENT } from '../core/equipment'
defineEmits<{ close: [] }>()
const store = useGameStore()
const goldInput = ref('100')
const hpInput = ref('50')
</script>
<template>
  <view class="dbg-overlay">
    <view class="dbg-blur" @click="$emit('close')" />
    <view class="dbg-panel">
      <view class="dbg-header"><text class="dbg-title">调试面板</text><view class="dbg-close" @click="$emit('close')"><text>×</text></view></view>
      <scroll-view class="dbg-body" scroll-y>
        <view class="dbg-section"><text class="dbg-label">快捷跳转</text><view class="dbg-row dbg-wrap"><view class="dbg-btn" @click="store.DEBUG_GO_SHOP()"><text>进商店</text></view><view class="dbg-btn" @click="store.DEBUG_GO_REST()"><text>进休息</text></view><view class="dbg-btn" @click="store.DEBUG_GO_BOSS()"><text>进Boss选择</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">装备操作</text><view class="dbg-row dbg-wrap"><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_SET_INVENTORY([...store.player.inventory, ALL_EQUIPMENT[Math.floor(Math.random() * ALL_EQUIPMENT.length)].id])"><text>随机掉落装备</text></view><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_DROP_10_EQUIP()"><text>掉落10件</text></view><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_SET_INVENTORY([])"><text>清空背包</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">金币操作</text><view class="dbg-row"><input class="dbg-input" v-model="goldInput" /><view class="dbg-btn" @click="store.DEBUG_ADD_GOLD(parseInt(goldInput) || 0)"><text>+金币</text></view><view class="dbg-btn dbg-btn-red" @click="store.DEBUG_ADD_GOLD(-(parseInt(goldInput) || 0))"><text>-金币</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">血量操作</text><view class="dbg-row"><input class="dbg-input" v-model="hpInput" /><view class="dbg-btn dbg-btn-green" @click="store.DEBUG_HEAL(parseInt(hpInput) || 0)"><text>+HP</text></view><view class="dbg-btn dbg-btn-red" @click="store.DEBUG_HEAL(-(parseInt(hpInput) || 0))"><text>-HP</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">经验 & 等级 (Lv.{{ store.player.level }} / {{ store.player.xp }}XP)</text><view class="dbg-row"><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_ADD_XP(10)"><text>+10XP</text></view><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_ADD_XP(50)"><text>+50XP</text></view><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_FORCE_LEVELUP()"><text>升级</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">强化操作</text><view class="dbg-row dbg-wrap"><view v-for="u in UPGRADE_POOL" :key="u.id" class="dbg-btn dbg-btn-sm" @click="store.DEBUG_ADD_UPGRADE(u.id)"><text>{{ u.name }}</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">图鉴操作</text><view class="dbg-row"><view class="dbg-btn" @click="store.DEBUG_UNLOCK_ALL_ENEMIES()"><text>解锁全部</text></view><view class="dbg-btn" @click="store.DEBUG_ADD_KILLS(5)"><text>全部+5杀</text></view><view class="dbg-btn dbg-btn-red" @click="store.DEBUG_CLEAR_BESTIARY()"><text>清空图鉴</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">战斗操作</text><view class="dbg-row"><view class="dbg-btn dbg-btn-red" @click="store.DEBUG_KILL_ENEMY()"><text>秒杀敌人</text></view><view class="dbg-btn" @click="store.DEBUG_FULL_TURNS()"><text>满步数</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">地图操作</text><view class="dbg-row"><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_SET_STAGE(1)"><text>S1</text></view><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_SET_STAGE(2)"><text>S2</text></view><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_SET_STAGE(3)"><text>S3</text></view></view></view>
      </scroll-view>
    </view>
  </view>
</template>
<style lang="scss">
.dbg-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 90; display: flex; align-items: flex-end; }
.dbg-blur { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
.dbg-panel { position: relative; width: 100%; max-height: 80vh; background: #1a1a2e; border-radius: 24rpx 24rpx 0 0; padding: 20rpx; display: flex; flex-direction: column; }
.dbg-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.dbg-title { font-size: 24rpx; font-weight: bold; color: #f1c40f; } .dbg-close { padding: 8rpx; font-size: 24rpx; color: #888; }
.dbg-body { flex: 1; } .dbg-section { margin-bottom: 16rpx; }
.dbg-label { font-size: 20rpx; color: #888; display: block; margin-bottom: 6rpx; }
.dbg-row { display: flex; gap: 8rpx; } .dbg-wrap { flex-wrap: wrap; }
.dbg-btn { background: rgba(255,255,255,0.08); border-radius: 8rpx; padding: 10rpx 18rpx; font-size: 22rpx; } .dbg-btn text { color: #ccc; }
.dbg-btn-sm { padding: 8rpx 14rpx; } .dbg-btn-red { background: rgba(231,76,60,0.2); } .dbg-btn-green { background: rgba(46,204,113,0.2); }
.dbg-input { width: 100rpx; height: 48rpx; background: rgba(255,255,255,0.06); border-radius: 6rpx; padding: 4rpx 8rpx; font-size: 22rpx; color: #fff; }
</style>
