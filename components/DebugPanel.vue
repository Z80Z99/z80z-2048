<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '../store/gameStore'
import { DEBUG_ENABLED } from '../store/debugActions'
import { UPGRADE_POOL, cardClassText } from '../core/upgrade'
import { CONSUMABLE_POOL } from '../core/consumables'
import { ALL_EQUIPMENT } from '../core/equipment'

const emit = defineEmits<{ close: [] }>()
const store = useGameStore()
const goldInput = ref('100')
const hpInput = ref('50')
function addRandomEquipment() {
  if (!DEBUG_ENABLED || store.battle) return
  const item = ALL_EQUIPMENT[Math.floor(Math.random() * ALL_EQUIPMENT.length)]
  store.DEBUG_SET_INVENTORY([...store.player.inventory, item.id])
}
</script>

<template>
  <view v-if="DEBUG_ENABLED" class="ui-overlay ui-sheet-overlay debug-overlay" @click="emit('close')"><view class="ui-sheet debug-panel" @click.stop>
    <view class="ui-sheet-header"><view><text class="ui-kicker">仅开发构建可用</text><text class="ui-sheet-title">调试控制台</text></view><button role="button" class="ui-close" @click="emit('close')">关闭</button></view>
    <text class="ui-note debug-note">调试会直接修改当前游戏数据。发布构建禁用所有入口与操作。</text>
    <scroll-view class="ui-scroll" scroll-y>
      <view class="debug-section"><text class="debug-label">快捷跳转</text><view class="debug-row"><button role="button" class="debug-btn" :disabled="Boolean(store.battle)" @click="store.DEBUG_GO_SHOP()">商店</button><button role="button" class="debug-btn" :disabled="Boolean(store.battle)" @click="store.DEBUG_GO_REST()">营地</button><button role="button" class="debug-btn" :disabled="Boolean(store.battle)" @click="store.DEBUG_GO_BOSS()">首领选择</button></view></view>
      <view class="debug-section"><text class="debug-label">装备</text><view class="debug-row"><button role="button" class="debug-btn" :disabled="Boolean(store.battle)" @click="addRandomEquipment">掉落一件</button><button role="button" class="debug-btn" @click="store.DEBUG_DROP_10_EQUIP()">掉落十件</button><button role="button" class="debug-btn debug-danger" :disabled="Boolean(store.battle)" @click="store.DEBUG_SET_INVENTORY([])">清空背包</button></view></view>
      <view class="debug-section"><text class="debug-label">金币 · 当前 {{ store.player.gold }}</text><view class="debug-row"><input v-model="goldInput" type="number" class="debug-input" aria-label="金币调整数量" /><button role="button" class="debug-btn" @click="store.DEBUG_ADD_GOLD(parseInt(goldInput, 10) || 0)">增加</button><button role="button" class="debug-btn debug-danger" @click="store.DEBUG_ADD_GOLD(-(parseInt(goldInput, 10) || 0))">减少</button></view></view>
      <view class="debug-section"><text class="debug-label">生命 · {{ store.effectivePlayer.hp }}/{{ store.effectivePlayer.maxHp }}</text><view class="debug-row"><input v-model="hpInput" type="number" class="debug-input" aria-label="生命调整数量" /><button role="button" class="debug-btn" @click="store.DEBUG_HEAL(parseInt(hpInput, 10) || 0)">回复</button><button role="button" class="debug-btn debug-danger" @click="store.DEBUG_HEAL(-(parseInt(hpInput, 10) || 0))">扣除</button></view></view>
      <view class="debug-section"><text class="debug-label">经验 · Lv.{{ store.player.level }} / {{ store.player.xp }} XP</text><view class="debug-row"><button role="button" class="debug-btn" @click="store.DEBUG_ADD_XP(10)">+10 XP</button><button role="button" class="debug-btn" @click="store.DEBUG_ADD_XP(50)">+50 XP</button><button role="button" class="debug-btn" @click="store.DEBUG_FORCE_LEVELUP()">升一级</button></view></view>
      <view class="debug-section"><text class="debug-label">强化</text><view class="debug-row"><button role="button" v-for="upgrade in UPGRADE_POOL" :key="upgrade.id" class="debug-btn" @click="store.DEBUG_ADD_UPGRADE(upgrade.id)">{{ cardClassText(upgrade.cardClass) }} · {{ upgrade.name }}</button></view></view>
      <view class="debug-section"><text class="debug-label">道具 · 只添加库存，不自动使用</text><view class="debug-row"><button role="button" v-for="item in CONSUMABLE_POOL" :key="item.id" class="debug-btn" @click="store.DEBUG_ADD_CONSUMABLE(item.id)">{{ cardClassText(item.cardClass) }} · {{ item.name }} +1</button></view></view>
      <view class="debug-section"><text class="debug-label">图鉴</text><view class="debug-row"><button role="button" class="debug-btn" @click="store.DEBUG_UNLOCK_ALL_ENEMIES()">解锁全部</button><button role="button" class="debug-btn" @click="store.DEBUG_ADD_KILLS(5)">全部 +5 杀</button><button role="button" class="debug-btn debug-danger" @click="store.DEBUG_CLEAR_BESTIARY()">清空图鉴</button></view></view>
      <view class="debug-section"><text class="debug-label">战斗</text><view class="debug-row"><button role="button" class="debug-btn" :disabled="store.battle?.phase !== 'playing'" @click="store.DEBUG_KILL_ENEMY()">击败敌人</button><button role="button" class="debug-btn" :disabled="store.battle?.phase !== 'playing'" @click="store.DEBUG_FULL_TURNS()">重置步数</button></view></view>
      <view class="debug-section"><text class="debug-label">阶段</text><view class="debug-row"><button role="button" v-for="stage in [1, 2, 3]" :key="stage" class="debug-btn" @click="store.DEBUG_SET_STAGE(stage)">S{{ stage }}</button></view></view>
    </scroll-view>
  </view></view>
</template>

<style scoped lang="scss">
.debug-overlay { z-index: 130; }
.debug-note { margin-bottom: 20rpx; color: var(--xp); }
.debug-section { margin-bottom: 24rpx; }
.debug-label { display: block; font-size: 28rpx; font-weight: 700; color: var(--text); margin-bottom: 12rpx; }
.debug-row { display: flex; flex-wrap: wrap; gap: 10rpx; align-items: center; }
.debug-btn { margin: 0; padding: 16rpx 18rpx; font-size: 26rpx; line-height: 1.4; background: var(--surface-raised); color: var(--text); border: 1px solid var(--line); border-radius: 10rpx; }
.debug-btn::after { border: none; }
.debug-btn[disabled] { background: var(--surface-soft); color: var(--muted); opacity: 0.7; }
.debug-danger { color: var(--attack); background: var(--attack-soft); }
.debug-input { width: 144rpx; min-height: 68rpx; padding: 0 14rpx; box-sizing: border-box; border: 1px solid var(--line); border-radius: 10rpx; background: var(--surface-soft); color: var(--text); font-size: 28rpx; }
</style>
