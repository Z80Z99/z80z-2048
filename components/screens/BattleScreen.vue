<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useGameStore } from '../../store/gameStore'
import { computeEquipBonuses } from '../../core/equipment'
import StatusBar from '../StatusBar.vue'
import EnemyDisplay from '../EnemyDisplay.vue'
import Board from '../Board.vue'
import ResultModal from '../ResultModal.vue'

const store = useGameStore()

const battle = computed(() => store.battle)

let roundTimer: any = null, finishTimer: any = null
watch(() => battle.value?.phase, (phase) => {
  if (phase === 'round_delay') roundTimer = setTimeout(() => store.SHOW_ROUND(), 700)
  if (phase === 'finish_delay') finishTimer = setTimeout(() => store.SHOW_BATTLE_RESULT(), 800)
})
onUnmounted(() => { if (roundTimer) clearTimeout(roundTimer); if (finishTimer) clearTimeout(finishTimer) })

const statusProps = computed(() => {
  const b = battle.value; if (!b) return {}
  const eq2 = computeEquipBonuses(store.player.equipment)
  let boardSum = 0, emptyCells = 0
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const v = b.grid[r]?.[c]?.value ?? 0; boardSum += v; if (v === 0) emptyCells++ }
  return { hp: store.player.hp, maxHp: store.player.maxHp, turnsUsed: b.turnsUsed, maxTurns: b.maxTurns, totalAttack: b.totalAttack, totalDefense: Math.floor(boardSum * store.player.defenseMultiplier * (1 + store.player.spawnReduction) / 6), totalSpeed: store.player.baseSpeed + emptyCells, gold: store.player.gold, flatAtk: store.player.flatAttack, flatDef: store.player.flatDefense, eqBonus: { spd: eq2.stats.spd || 0, hp: eq2.stats.hp || 0 }, atkMult: store.player.attackMultiplier, defMult: store.player.defenseMultiplier, round: b.round, xp: store.player.xp, xpToNext: store.player.xpToNext, level: store.player.level }
})
</script>

<template>
  <view v-if="battle" class="screen battle-screen">
    <StatusBar v-bind="statusProps" />
    <EnemyDisplay :enemy="battle.enemy" :current-hp="battle.enemyCurrentHp" :round="battle.round" :enemy-atk-down="store.player.enemyAtkDown" />
    <Board />
    <view v-if="battle.phase === 'playing'" class="early-end-wrap">
      <view class="early-end-btn" @click="store.END_TURN_EARLY()">
        <text class="early-end-text">提前结束 (+{{ battle.maxTurns - battle.turnsUsed }}步奖励)</text>
      </view>
    </view>

    <template v-if="battle.phase === 'round_end' && battle.lastRoundResult">
      <view class="round-overlay">
        <view class="round-card">
          <text class="round-title">第 {{ battle.round }} 回合结束</text>
          <view class="round-speed-duel">
            <view class="round-speed-side">
              <text class="round-speed-who">你</text>
              <view class="round-speed-bar-wrap">
                <view :class="['round-speed-bar', battle.lastRoundResult.playerFirst ? 'round-speed-win' : 'round-speed-lose']"
                  :style="{ width: `${(battle.lastRoundResult.playerSpeed / Math.max(battle.lastRoundResult.playerSpeed, battle.lastRoundResult.enemySpeed)) * 100}%` }" />
              </view>
              <text class="round-speed-num">{{ battle.lastRoundResult.playerSpeed }}</text>
            </view>
            <view class="round-speed-center">
              <text class="round-speed-icon">{{ battle.lastRoundResult.playerFirst ? '>' : '<' }}</text>
              <text class="round-speed-vs">SPD</text>
            </view>
            <view class="round-speed-side">
              <text class="round-speed-num">{{ battle.lastRoundResult.enemySpeed }}</text>
              <view class="round-speed-bar-wrap round-speed-bar-right">
                <view :class="['round-speed-bar', !battle.lastRoundResult.playerFirst ? 'round-speed-win' : 'round-speed-lose']"
                  :style="{ width: `${(battle.lastRoundResult.enemySpeed / Math.max(battle.lastRoundResult.playerSpeed, battle.lastRoundResult.enemySpeed)) * 100}%` }" />
              </view>
              <text class="round-speed-who">{{ battle.enemy.name }}</text>
            </view>
          </view>
          <view class="round-log">
            <template v-if="battle.lastRoundResult.playerFirst">
              <view class="round-log-item round-log-you">
                <text class="round-log-icon">⚔</text>
                <text class="round-log-text">你率先攻击，造成 {{ battle.lastRoundResult.enemyDamage }} 点伤害</text>
              </view>
              <view v-if="battle.lastRoundResult.playerDamage > 0" class="round-log-item round-log-enemy">
                <text class="round-log-icon">↺</text>
                <text class="round-log-text">敌人反击，你受到 {{ battle.lastRoundResult.playerDamage }} 点伤害</text>
              </view>
              <text v-if="battle.lastRoundResult.playerDamage === 0" class="round-log-msg">敌人来不及反击!</text>
            </template>
            <template v-else>
              <view class="round-log-item round-log-enemy">
                <text class="round-log-icon">⚔</text>
                <text class="round-log-text">敌人抢先攻击，你受到 {{ battle.lastRoundResult.playerDamage }} 点伤害</text>
              </view>
              <view v-if="battle.lastRoundResult.enemyDamage > 0" class="round-log-item round-log-you">
                <text class="round-log-icon">↺</text>
                <text class="round-log-text">你反击，造成 {{ battle.lastRoundResult.enemyDamage }} 点伤害</text>
              </view>
            </template>
          </view>
          <view class="round-hp-row">
            <view class="round-hp-item">
              <text class="round-hp-label">敌人 HP</text>
              <text class="round-hp-val">{{ battle.enemyCurrentHp }} / {{ battle.enemy.maxHp }}</text>
            </view>
          </view>
          <button class="round-btn" @click="store.NEXT_ROUND()">下一回合</button>
        </view>
      </view>
    </template>

    <template v-if="battle.phase === 'finished' && battle.result">
      <ResultModal :result="battle.result" />
    </template>
  </view>
</template>

<style lang="scss">
.battle-screen { background: #0d0d1a; animation: screen-enter 0.3s ease-out; }
.early-end-wrap { display: flex; justify-content: center; margin-top: 16rpx; }
.early-end-btn { padding: 12rpx 32rpx; background: rgba(241,196,15,0.1); border: 1px solid rgba(241,196,15,0.2); border-radius: 24rpx; }
.early-end-text { font-size: 22rpx; color: #f1c40f; }
.round-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; animation: overlay-in 0.3s; }
.round-card { background: linear-gradient(180deg, #1a1a2e, #12122a); border: 1px solid rgba(255,255,255,0.08); border-radius: 20rpx; padding: 32rpx 28rpx; width: 320px; animation: card-pop 0.35s cubic-bezier(0.34,1.56,0.64,1); }
.round-title { font-size: 28px; font-weight: bold; color: #f1c40f; text-align: center; display: block; margin-bottom: 24rpx; }
.round-speed-duel { display: flex; align-items: center; gap: 12rpx; margin-bottom: 24rpx; } .round-speed-side { flex: 1; display: flex; flex-direction: column; gap: 6rpx; }
.round-speed-who { font-size: 18rpx; color: #888; text-align: center; } .round-speed-num { font-size: 24rpx; font-weight: bold; color: #ccc; text-align: center; }
.round-speed-bar-wrap { height: 10rpx; background: rgba(255,255,255,0.06); border-radius: 5rpx; overflow: hidden; } .round-speed-bar-right { direction: rtl; }
.round-speed-bar { height: 100%; border-radius: 5rpx; } .round-speed-win { background: #2ecc71; } .round-speed-lose { background: #555; }
.round-speed-center { display: flex; flex-direction: column; align-items: center; } .round-speed-icon { font-size: 32rpx; font-weight: bold; color: #f1c40f; } .round-speed-vs { font-size: 16rpx; color: #888; }
.round-log { margin-bottom: 20rpx; } .round-log-item { display: flex; align-items: flex-start; gap: 10rpx; padding: 12rpx; border-radius: 10rpx; margin-bottom: 8rpx; }
.round-log-you { background: rgba(46,204,113,0.1); border-left: 4rpx solid #2ecc71; } .round-log-enemy { background: rgba(231,76,60,0.1); border-left: 4rpx solid #e74c3c; }
.round-log-icon { font-size: 24rpx; width: 32rpx; } .round-log-text { font-size: 22rpx; color: #ccc; line-height: 36rpx; flex: 1; }
.round-log-msg { font-size: 20rpx; color: #f1c40f; text-align: center; display: block; padding: 8rpx 0; font-weight: bold; }
.round-hp-row { display: flex; justify-content: center; margin-bottom: 20rpx; } .round-hp-item { text-align: center; }
.round-hp-label { font-size: 20rpx; color: #888; display: block; } .round-hp-val { font-size: 26rpx; font-weight: bold; color: #e74c3c; margin-top: 4rpx; }
.round-btn { background: #f1c40f; color: #1a1a2e; border: none; border-radius: 12rpx; font-size: 16px; font-weight: bold; padding: 16rpx; width: 100%; }
</style>
