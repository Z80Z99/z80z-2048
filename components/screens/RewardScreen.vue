<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../store/gameStore'
import { rarityText } from '../../core/upgrade'
import ItemIcon from '../ItemIcon.vue'

const store = useGameStore()
const headings = {
  start: { label: '传承已启', title: '选择初始强化', note: '来自永久升级的馈赠，为本次冒险定下方向。' },
  levelup: { label: '等级提升', title: '让力量更进一步', note: '选择一项强化，迎接更深处的挑战。' },
  elite: { label: '精英战利品', title: '险战，值得回报', note: '选择一项强化，作为本次精英战斗的奖励。' },
  boss: { label: '首领战利品', title: '新的力量已解锁', note: '选择一项强化，然后决定旅程的下一步。' },
}
const heading = computed(() => headings[store.rewardReason] ?? headings.levelup)
const remaining = computed(() => Math.max(0, store.pendingLevels))
function existingCount(id: string) { return store.upgrades.find(upgrade => upgrade.def.id === id)?.count ?? 0 }
</script>

<template>
  <view class="screen reward-screen">
    <view class="ui-page reward-content">
      <view class="reward-header"><text class="ui-kicker">{{ heading.label }} · Lv.{{ store.effectivePlayer.level }}</text><text class="ui-title reward-title">{{ heading.title }}</text><text class="ui-body">{{ heading.note }}</text></view>
      <view class="reward-count"><text>本次选择 1 项</text><text v-if="remaining">之后还有 {{ remaining }} 次奖励</text><text v-else>当前队列最后一份奖励</text></view>
      <view class="reward-choices">
        <button role="button" v-for="(upgrade, index) in store.rewardChoices" :key="upgrade.id" class="reward-card art-card" :class="`reward-${upgrade.rarity}`" @click="store.PICK_UPGRADE(upgrade.id)">
          <view class="reward-card-mark"><ItemIcon :upgrade-type="upgrade.effect.type" :rarity="upgrade.rarity" size="normal" /><text class="reward-card-index" aria-hidden="true">{{ (index + 1).toString().padStart(2, '0') }}</text></view>
          <view class="reward-card-main"><view class="reward-card-meta"><text class="reward-rarity art-paper-label">{{ rarityText(upgrade.rarity) }}</text><text class="reward-duration">{{ upgrade.effect.type === 'heal' ? '立即回复' : '本局生效' }}</text></view><text class="reward-card-name">{{ upgrade.name }}</text><text class="reward-card-desc">{{ upgrade.description }}</text><text v-if="upgrade.effect.type !== 'heal'" class="reward-stacks">已选 {{ existingCount(upgrade.id) }} / {{ upgrade.maxStacks }} 次</text></view>
          <text class="reward-select-arrow">→</text>
        </button>
      </view>
      <button role="button" class="ui-btn ui-btn-quiet reward-skip" @click="store.SKIP_REWARD()">仅跳过这次奖励</button>
      <text class="ui-note reward-skip-note">{{ remaining ? '后续奖励仍会依次出现，不会一起跳过。' : '跳过后继续当前冒险流程。' }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.reward-content { max-width: 740rpx; padding-top: 32rpx; }
.reward-title { margin: 16rpx 0 20rpx; }
.reward-count { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10rpx; margin: 30rpx 0 18rpx; color: var(--muted); font-size: 26rpx; }
.reward-count text:first-child { color: var(--accent); font-weight: 700; }
.reward-choices { display: flex; flex-direction: column; gap: 16rpx; }
.reward-card { display: flex; align-items: flex-start; gap: 20rpx; width: 100%; margin: 0; padding: 26rpx 22rpx; box-sizing: border-box; text-align: left; line-height: 1.5; background-color: var(--surface); border: 1px solid var(--line); border-left: 4rpx solid var(--rarity-common); border-radius: 16rpx; color: var(--text); box-shadow: var(--shadow); }
.reward-card::after { border: none; }
.reward-card:active { background: var(--accent-soft); }
.reward-rare { border-left-color: var(--rarity-rare); }
.reward-epic { border-left-color: var(--rarity-epic); }
.reward-card-mark { flex-shrink: 0; width: 80rpx; display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.reward-card-index { font-size: 22rpx; color: var(--dim); letter-spacing: 2rpx; }
.reward-card-main { flex: 1; min-width: 0; }
.reward-card-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 8rpx; margin-bottom: 10rpx; flex-wrap: wrap; }
.reward-rarity, .reward-duration, .reward-stacks { font-size: 24rpx; color: var(--muted); }
.reward-rare .reward-rarity { color: var(--rarity-rare); }
.reward-epic .reward-rarity { color: var(--rarity-epic); }
.reward-card-name { display: block; font-size: 32rpx; font-weight: 800; color: var(--text); margin-bottom: 8rpx; }
.reward-card-desc { display: block; font-size: 28rpx; color: var(--muted); line-height: 1.65; white-space: normal; }
.reward-stacks { display: block; margin-top: 12rpx; }
.reward-select-arrow { font-size: 30rpx; color: var(--accent); align-self: center; }
.reward-skip { width: 100%; margin-top: 32rpx; }
.reward-skip-note { margin-top: 16rpx; text-align: center; }
@media (max-width: 360px) {
  .reward-card { gap: 12rpx; padding: 22rpx 16rpx; }
  .reward-select-arrow { display: none; }
}
</style>
