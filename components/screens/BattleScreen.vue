<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useGameStore } from '../../store/gameStore'
import StatusBar from '../StatusBar.vue'
import EnemyDisplay from '../EnemyDisplay.vue'
import Board from '../Board.vue'
import ResultModal from '../ResultModal.vue'
import { stageArtwork } from '../../utils/artwork'

const store = useGameStore()
const battle = computed(() => store.battle)
const player = computed(() => store.effectivePlayer)
const preview = computed(() => store.battlePreview)
const nodeKind = computed(() => store.route.find(node => node.id === store.currentNodeId)?.type)
const stageName = computed(() => store.stage === 1 ? '地牢入口' : store.stage === 2 ? '深渊回廊' : store.stage === 3 ? '终焉之间' : '无尽深渊')
const result = computed(() => battle.value?.lastRoundResult)
const showForecastDetails = ref(false)
const remainingSteps = computed(() => Math.max(0, (battle.value?.maxTurns ?? 0) - (battle.value?.turnsUsed ?? 0)))
let phaseTimer: ReturnType<typeof setTimeout> | undefined
watch(() => battle.value?.phase, phase => {
  if (phaseTimer) clearTimeout(phaseTimer)
  if (phase === 'round_delay') phaseTimer = setTimeout(() => {
    if (store.battle?.phase === 'round_delay') store.SHOW_ROUND()
  }, 500)
  if (phase === 'finish_delay') phaseTimer = setTimeout(() => {
    if (store.battle?.phase === 'finish_delay') store.SHOW_BATTLE_RESULT()
  }, 600)
}, { immediate: true })
onUnmounted(() => { if (phaseTimer) clearTimeout(phaseTimer) })

const chanceEffects = computed(() => {
  const effects = battle.value?.equipEffects
  const labels: string[] = []
  if (effects?.dodge) labels.push(`闪避 ${Math.round(effects.dodge * 100)}%`)
  if (effects?.skipChance) labels.push(`敌人停手 ${Math.round(effects.skipChance * 100)}%`)
  return labels
})
const roundLogs = computed(() => {
  const rr = result.value
  if (!rr) return []
  const logs: { kind: string; text: string }[] = []
  const attack = () => logs.push({ kind: 'attack', text: rr.playerActed === false ? '你未能出手，本回合没有攻击。' : `你${rr.playerFirst ? '先手攻击' : '随后攻击'}，造成 ${rr.enemyDamage} 点伤害。` })
  const defend = () => {
    let text = ''
    switch (rr.avoidReason) {
      case 'kill': text = '敌人已被击败，未能出手。'; break
      case 'skip': text = '停手效果触发：敌人跳过本次攻击。'; break
      case 'dodge': text = '闪避触发：你避开了敌人的攻击。'; break
      case 'defense': text = '防御完全抵消了敌人的攻击，未损失生命。'; break
      default: text = rr.enemyActed === false ? '敌人本回合未出手。' : rr.playerDamage > 0 ? `敌人${rr.playerFirst ? '反击' : '先手攻击'}，你受到 ${rr.playerDamage} 点伤害。` : '敌人攻击未造成生命损失。'
    }
    logs.push({ kind: 'defense', text })
  }
  if (rr.playerFirst) { attack(); defend() } else { defend(); attack() }
  if (rr.fortifyTriggered) logs.push({ kind: 'defense', text: '首击守护已生效，本次来袭伤害减半。' })
  if (rr.reflectedDamage) logs.push({ kind: 'attack', text: `反弹造成 ${rr.reflectedDamage} 点伤害。` })
  if (rr.healing) logs.push({ kind: 'heal', text: `吸血与恢复共回复 ${rr.healing} 点生命。` })
  return logs
})
</script>

<template>
  <view v-if="battle && preview" class="screen battle-screen">
    <image class="battle-scenery" :src="stageArtwork(store.stage)" mode="aspectFill" alt="" aria-hidden="true" />
    <view class="battle-content">
      <view class="battle-heading"><text class="ui-kicker">S{{ store.stage }} · {{ stageName }}</text><text class="battle-heading-note">合并，为下一击蓄力</text></view>
      <StatusBar :hp="player.hp" :max-hp="player.maxHp" :turns-used="battle.turnsUsed" :max-turns="battle.maxTurns"
        :total-attack="battle.totalAttack" :total-defense="preview.defenseValue" :total-speed="preview.playerSpeed"
        :gold="player.gold" :round="battle.round" :xp="player.xp" :xp-to-next="player.xpToNext" :level="player.level"
        :atk-mult="player.attackMultiplier" :def-mult="player.defenseMultiplier" :flat-atk="player.flatAttack" :flat-def="player.flatDefense" />
      <EnemyDisplay :enemy="battle.enemy" :current-hp="battle.enemyCurrentHp" :round="battle.round"
        :attack="preview.enemyAttack" :defense="preview.enemyDefense" :speed="preview.enemySpeed" :kind="nodeKind" />
      <view class="battle-forecast">
        <view class="forecast-summary">
          <view class="forecast-copy">
            <view class="forecast-title-row"><text class="forecast-label">单次出手 · 基准预估</text><text class="forecast-order">{{ preview.playerFirst ? '你先手' : '敌人先手' }}</text></view>
            <view class="forecast-values"><text>你出手 <text class="forecast-number stat-attack">{{ preview.enemyDamage }}</text></text><text>敌出手 <text class="forecast-number stat-attack">{{ preview.playerDamage }}</text></text></view>
          </view>
          <button role="button" class="forecast-toggle" :aria-expanded="showForecastDetails" aria-controls="forecast-details" @click="showForecastDetails = !showForecastDetails">{{ showForecastDetails ? '收起' : '说明' }}<text class="forecast-toggle-mark">{{ showForecastDetails ? '−' : '+' }}</text></button>
        </view>
        <view v-if="showForecastDetails" id="forecast-details" class="forecast-details">
          <text class="forecast-note">只表示双方实际出手时的单次伤害，不是本回合必然结果。先手击杀会阻止反击；未计闪避、停手、反弹与回复。</text>
          <text class="forecast-note">保留步数每步计 2 金币，各回合累计，仅战斗胜利时发放。提前结束会立即结算本回合。</text>
          <!-- #ifdef H5 -->
          <text class="forecast-note">网页端也可使用键盘方向键移动棋盘。</text>
          <!-- #endif -->
        </view>
        <text v-if="chanceEffects.length" class="forecast-chances">概率效果（不保证）：{{ chanceEffects.join(' · ') }}</text>
      </view>
      <view class="battle-board"><Board /></view>
      <view class="early-end-wrap">
        <button role="button" class="ui-btn ui-btn-secondary early-end-btn" :disabled="battle.phase !== 'playing'" @click="store.END_TURN_EARLY()">
          {{ battle.phase === 'playing' ? '结束本回合' : '正在结算' }}
          <text v-if="battle.phase === 'playing'" class="early-end-steps">保留 {{ remainingSteps }} 步 · 胜利 +{{ remainingSteps * 2 }} 金币</text>
        </button>
        <text class="early-end-note">保留步数每步 2 金币 · 跨回合累计 · 仅胜利发放</text>
        <text v-if="battle.savedSteps > 0" class="early-end-saved">已累计 {{ battle.savedSteps }} 步，胜利后 +{{ battle.savedSteps * 2 }} 金币</text>
      </view>
    </view>

    <view v-if="battle.phase === 'round_end' && result" class="ui-overlay">
      <view class="ui-dialog round-card">
        <text class="ui-kicker">回合记录 / ROUND {{ battle.round }}</text>
        <text class="ui-title round-title">第 {{ battle.round }} 回合结束</text>
        <view class="round-order"><text>你的速度 {{ Number(result.playerSpeed.toFixed(2)) }}</text><text class="stat-speed">{{ result.playerFirst ? '你先手' : '敌人先手' }}</text><text>敌方 {{ result.enemySpeed }}</text></view>
        <view class="round-logs"><view v-for="(log, index) in roundLogs" :key="index" class="round-log" :class="`round-log-${log.kind}`"><text>{{ log.text }}</text></view></view>
        <view class="round-hp-row">
          <view><text class="ui-note">你的生命</text><text class="round-hp-value stat-hp">{{ result.playerHpAfter ?? player.hp }} / {{ player.maxHp }}</text></view>
          <view><text class="ui-note">敌方生命</text><text class="round-hp-value stat-attack">{{ battle.enemyCurrentHp }} / {{ battle.enemy.maxHp }}</text></view>
        </view>
        <text class="ui-note round-next-note">下一回合：方块数值减半（最低为 2），敌人继续成长。</text>
        <button role="button" class="ui-btn" @click="store.NEXT_ROUND()">进入第 {{ battle.round + 1 }} 回合</button>
      </view>
    </view>
    <ResultModal v-if="battle.phase === 'finished' && battle.result" :result="battle.result" />
  </view>
</template>

<style scoped lang="scss">
.battle-screen { position: relative; min-height: 0; padding: 12rpx 24rpx 8rpx; }
/* 仅底图参与定位；HUD 与棋盘保留原有高度，固定弹层仍相对视口。 */
.battle-scenery { position: absolute; z-index: 0; top: 0; left: 0; width: 100%; height: 450rpx; opacity: 0.14; pointer-events: none; }
.battle-content { position: relative; z-index: 1; width: 100%; max-width: 760rpx; margin: 0 auto; }
.battle-heading { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 6rpx; padding: 0 2rpx 10rpx; }
.battle-heading-note { font-size: 24rpx; line-height: 1.3; color: var(--muted); }
.battle-forecast { padding: 10rpx 16rpx; margin-bottom: 12rpx; background: var(--surface-soft); border: 1px solid var(--line); border-radius: 12rpx; }
.forecast-summary { display: flex; align-items: center; gap: 14rpx; }
.forecast-copy { flex: 1; min-width: 0; }
.forecast-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.forecast-label { font-size: 24rpx; line-height: 1.3; font-weight: 700; color: var(--text); }
.forecast-order { color: var(--speed); font-size: 24rpx; line-height: 1.3; }
.forecast-values { display: flex; justify-content: space-between; gap: 12rpx; margin-top: 3rpx; color: var(--muted); font-size: 26rpx; line-height: 1.4; }
.forecast-number { font-size: 30rpx; font-weight: 800; margin-left: 6rpx; }
.forecast-toggle { display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; box-sizing: border-box; min-width: 72rpx; min-height: 70rpx; padding: 5rpx 10rpx; margin: 0; border-left: 1px solid var(--line); border-radius: 0; background: none; color: var(--accent); font-size: 24rpx; line-height: 1.3; }
.forecast-toggle::after { border: none; }
.forecast-toggle-mark { font-size: 24rpx; }
.forecast-details { border-top: 1px solid var(--line); margin-top: 12rpx; padding-top: 12rpx; }
.forecast-note { display: block; font-size: 26rpx; color: var(--muted); line-height: 1.6; margin-bottom: 10rpx; }
.forecast-chances { display: block; font-size: 24rpx; color: var(--xp); line-height: 1.45; margin-top: 8rpx; }
.battle-board { width: 100%; max-width: 660rpx; margin: 0 auto; }
.battle-board :deep(.board-hint) { font-size: 24rpx; line-height: 1.3; margin-top: 8rpx; }
.battle-board :deep(.board-keyboard-hint) { display: none; }
.early-end-wrap { max-width: 660rpx; margin: 10rpx auto 0; }
.early-end-btn { width: 100%; min-height: 76rpx; padding: 14rpx 18rpx; justify-content: space-between; flex-wrap: wrap; gap: 6rpx 12rpx; font-size: 28rpx; }
.early-end-steps { font-size: 24rpx; color: var(--gold); font-weight: 500; line-height: 1.4; }
.early-end-note { display: block; margin-top: 8rpx; color: var(--muted); font-size: 24rpx; line-height: 1.4; text-align: center; }
.early-end-saved { display: block; color: var(--gold); font-size: 24rpx; line-height: 1.4; margin-top: 4rpx; text-align: center; }
.round-title { font-size: 40rpx; margin: 12rpx 0 24rpx; }
.round-order { display: flex; justify-content: space-between; gap: 12rpx; font-size: 26rpx; color: var(--muted); padding: 16rpx 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.round-logs { margin: 24rpx 0; }
.round-log { border-left: 3rpx solid var(--line); padding: 14rpx 16rpx; margin-bottom: 10rpx; font-size: 28rpx; line-height: 1.65; color: var(--text); background: var(--surface-soft); border-radius: 0 10rpx 10rpx 0; }
.round-log-attack { border-color: var(--attack); }
.round-log-defense { border-color: var(--defense); }
.round-log-heal { border-color: var(--hp); }
.round-hp-row { display: flex; justify-content: space-between; gap: 18rpx; margin: 20rpx 0; }
.round-hp-value { display: block; font-size: 30rpx; font-weight: 800; }
.round-next-note { margin: 24rpx 0; }
</style>
