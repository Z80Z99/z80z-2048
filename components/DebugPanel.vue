<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '../store/gameStore'
import { UPGRADE_POOL } from '../core/upgrade'
import { ALL_EQUIPMENT } from '../core/equipment'
const emit = defineEmits<{ close: [] }>()
// 关闭动画：先播滑出，250ms 后再真正关闭
const closing = ref(false)
let closeTimer: any = null
function close() {
  if (closing.value) return
  closing.value = true
  closeTimer = setTimeout(() => emit('close'), 250)
}
const store = useGameStore()
const goldInput = ref('100')
const hpInput = ref('50')
</script>
<template>
  <view class="dbg-overlay">
    <view class="dbg-blur" :class="{ closing }" @click="close()" />
    <view class="dbg-panel" :class="{ closing }">
      <view class="dbg-header"><text class="dbg-title">调试面板</text><view class="dbg-close" @click="close()"><text class="dbg-txt">×</text></view></view>
      <scroll-view class="dbg-body" scroll-y>
        <view class="dbg-section"><text class="dbg-label">快捷跳转</text><view class="dbg-row dbg-wrap"><view class="dbg-btn" @click="store.DEBUG_GO_SHOP()"><text class="dbg-txt">进商店</text></view><view class="dbg-btn" @click="store.DEBUG_GO_REST()"><text class="dbg-txt">进休息</text></view><view class="dbg-btn" @click="store.DEBUG_GO_BOSS()"><text class="dbg-txt">进Boss选择</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">装备操作</text><view class="dbg-row dbg-wrap"><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_SET_INVENTORY([...store.player.inventory, ALL_EQUIPMENT[Math.floor(Math.random() * ALL_EQUIPMENT.length)].id])"><text class="dbg-txt">随机掉落装备</text></view><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_DROP_10_EQUIP()"><text class="dbg-txt">掉落10件</text></view><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_SET_INVENTORY([])"><text class="dbg-txt">清空背包</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">金币操作</text><view class="dbg-row"><input class="dbg-input" v-model="goldInput" /><view class="dbg-btn" @click="store.DEBUG_ADD_GOLD(parseInt(goldInput) || 0)"><text class="dbg-txt">+金币</text></view><view class="dbg-btn dbg-btn-red" @click="store.DEBUG_ADD_GOLD(-(parseInt(goldInput) || 0))"><text class="dbg-txt">-金币</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">血量操作</text><view class="dbg-row"><input class="dbg-input" v-model="hpInput" /><view class="dbg-btn dbg-btn-green" @click="store.DEBUG_HEAL(parseInt(hpInput) || 0)"><text class="dbg-txt">+HP</text></view><view class="dbg-btn dbg-btn-red" @click="store.DEBUG_HEAL(-(parseInt(hpInput) || 0))"><text class="dbg-txt">-HP</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">经验 & 等级 (Lv.{{ store.player.level }} / {{ store.player.xp }}XP)</text><view class="dbg-row"><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_ADD_XP(10)"><text class="dbg-txt">+10XP</text></view><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_ADD_XP(50)"><text class="dbg-txt">+50XP</text></view><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_FORCE_LEVELUP()"><text class="dbg-txt">升级</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">强化操作</text><view class="dbg-row dbg-wrap"><view v-for="u in UPGRADE_POOL" :key="u.id" class="dbg-btn dbg-btn-sm" @click="store.DEBUG_ADD_UPGRADE(u.id)"><text class="dbg-txt">{{ u.name }}</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">图鉴操作</text><view class="dbg-row"><view class="dbg-btn" @click="store.DEBUG_UNLOCK_ALL_ENEMIES()"><text class="dbg-txt">解锁全部</text></view><view class="dbg-btn" @click="store.DEBUG_ADD_KILLS(5)"><text class="dbg-txt">全部+5杀</text></view><view class="dbg-btn dbg-btn-red" @click="store.DEBUG_CLEAR_BESTIARY()"><text class="dbg-txt">清空图鉴</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">战斗操作</text><view class="dbg-row"><view class="dbg-btn dbg-btn-red" @click="store.DEBUG_KILL_ENEMY()"><text class="dbg-txt">秒杀敌人</text></view><view class="dbg-btn" @click="store.DEBUG_FULL_TURNS()"><text class="dbg-txt">满步数</text></view></view></view>
        <view class="dbg-section"><text class="dbg-label">地图操作</text><view class="dbg-row"><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_SET_STAGE(1)"><text class="dbg-txt">S1</text></view><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_SET_STAGE(2)"><text class="dbg-txt">S2</text></view><view class="dbg-btn dbg-btn-sm" @click="store.DEBUG_SET_STAGE(3)"><text class="dbg-txt">S3</text></view></view></view>
      </scroll-view>
    </view>
  </view>
</template>
<style lang="scss">
.dbg-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 90; display: flex; align-items: flex-end; }
.dbg-blur { position: absolute; inset: 0; background: rgba(0,0,0,0.5); animation: fade-in 0.2s ease-out; }
.dbg-panel { position: relative; width: 100%; height: 80vh; background: #1a1a2e; border-radius: 24rpx 24rpx 0 0; padding: 20rpx; display: flex; flex-direction: column; animation: panel-rise 0.3s cubic-bezier(0.22,0.99,0.38,1.02); }
.dbg-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.dbg-title { font-size: 24rpx; font-weight: bold; color: #f1c40f; } .dbg-close { padding: 8rpx; font-size: 24rpx; color: #888; }
.dbg-body { flex: 1; height: 0; } .dbg-section { margin-bottom: 16rpx; }
.dbg-label { font-size: 20rpx; color: #888; display: block; margin-bottom: 6rpx; }
.dbg-row { display: flex; gap: 8rpx; } .dbg-wrap { flex-wrap: wrap; }
.dbg-btn { background: rgba(255,255,255,0.08); border-radius: 8rpx; padding: 10rpx 18rpx; font-size: 22rpx; } .dbg-btn .dbg-txt { color: #ccc; }
.dbg-btn-sm { padding: 8rpx 14rpx; } .dbg-btn-red { background: rgba(231,76,60,0.2); } .dbg-btn-green { background: rgba(46,204,113,0.2); }
.dbg-input { width: 100rpx; height: 48rpx; background: rgba(255,255,255,0.06); border-radius: 6rpx; padding: 4rpx 8rpx; font-size: 22rpx; color: #fff; }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes panel-rise { from { transform: translateY(50%); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes panel-rise { from { transform: translateY(50%); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
.dbg-blur.closing { animation: fade-out 0.25s ease-in forwards; }
.dbg-panel.closing { animation: panel-exit 0.25s ease-in forwards; }
@keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes panel-exit { from { transform: translateY(0); opacity: 1; } to { transform: translateY(50%); opacity: 0.6; } }
</style>
