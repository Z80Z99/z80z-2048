<script setup lang="ts">
import { ref } from 'vue'
const emit = defineEmits<{ close: [] }>()
const openSection = ref(0)
const sections = [
  { title: '从一次合并开始', tag: '操作', items: [
    '在 4×4 棋盘上向上、下、左、右滑动，相同数字碰撞后合并：2 + 2 → 4，4 + 4 → 8。每个方块一次滑动最多合并一次。',
    '只有有效移动才消耗步数并生成新方块。新方块 90% 为 2，10% 为 4。棋盘不动时不会白白消耗一步。',
    '基础每回合 6 步，强化与装备可以增加步数。没有可移动方向时，可点击「结束本回合」。网页端也可使用键盘方向键。',
    '每次合并的结果数值累积为本回合攻击蓄力。下一回合方块数值减半，最低为 2；攻击蓄力清零。',
  ] },
  { title: '攻击、防御与先手', tag: '战斗', items: [
    '合并增加攻击蓄力，并腾出空格。合并本身保留棋盘数值总和；之后生成的新方块才会提高盘面总和。',
    '盘面防御 = 向下取整（棋盘总和 × 防御倍率 ×（1 + 棋盘防御加成）÷ 6）。固定防御另行抵扣来袭伤害，没有 70% 的总减伤上限。',
    '「棋盘防御加成」类强化的同类加成合计上限为 50%，不等同于总减伤上限。',
    '对敌伤害由合并蓄力、攻击倍率、固定攻击和敌方防御决定；套装穿透、首击守护等效果也会影响最终结算。面板「基准预估」与战斗使用同一套计算。',
    '你的速度 = 实际基础速度 + 棋盘空格数。速度更高者先手，同速时你先手；先手击杀能阻止对方攻击，先手套装可改变顺序。',
    '闪避和敌人停手属于概率效果，不保证触发。零受伤也可能是防御抵消；回合记录会区分实际原因。',
    '提前结束保留的每步计 2 金币，所有回合累计，仅在本场战斗胜利时发放。失败不获得这份奖励。',
  ] },
  { title: '装备与套装', tag: '行装', items: [
    '装备有头盔、铠甲、手套、护腿、战靴 5 个部位。购买与掉落的装备进入背包，点击装备可更换对应部位。战斗期间只能查看，不能更换或卸下。',
    '套装装备的攻击、防御为固定数值；独立装备的攻击、防御为百分比。所有装备的生命与速度为固定值，金币与经验为百分比；每件装备都标明实际单位。',
    '同一套装跨等级、跨品质计件。达到 2 / 3 / 5 件时逐档激活效果，装备页会明确显示已激活和未激活的效果。',
    '独立装备有随机词条：普通 1–2 条，稀有 2–3 条，史诗 3–4 条。装备等级随阶段提高，同名装备也可能具有不同数值。',
    '实际生命上限、倍率、固定加成与速度均已计入装备、套装和当前战斗效果，不需要再次手动相加。',
  ] },
  { title: '升级与战利品', tag: '成长', items: [
    '战斗胜利获得金币和经验，并可能掉落装备。精英与首领带来更高奖励，也会带来额外的强化选择。',
    '经验满时升级并获得强化选择。一次战斗带来的多份奖励会依次出现，点击「仅跳过这次奖励」不会跳过后面的选择。',
    '强化效果通常仅在本局冒险内有效。治疗是立即生效的一次性补给，不占用可移除的强化列表。',
    '初始强化选择需要在永久升级中解锁；未解锁时，开始冒险会直接进入路线。',
    '胜利时的溢出伤害可择一转为额外金币（1:1）或额外经验（2:1，向下取整）。每份战利品只结算一次。',
  ] },
  { title: '路线、奇遇与补给', tag: '探索', items: [
    '每阶段有 10 层路线，第 11 层是守关首领。从下向上，只能沿虚线进入相连的节点，每层只能选择一个节点，无法回头。地图可自由滚动，点击「当前层」可回到可选位置。',
    '战斗、精英、事件、商店与休息点各有收益。营地按实际生命上限的 30% 回复，回复量不超过已损失的生命。',
    '商店强化、装备与药水在刷新时一起更新。刷新 10 金币起，每次加价；移除一层强化每店限一次。消费前会显示价格与不足原因。',
    '奇遇中需要支付金币、装备等代价的选项，会先检查可用资源。不可支付的选项不会扣款或悄悄执行。',
    '敌人每回合会成长。从第 2 阶段起可能携带强化，展开敌方能力可查看详情；当前属性已计入成长与削弱。',
    '击败首领后可继续攀登，或胜利结算离开。第 4 阶段起是无尽模式，敌人随阶段持续增强。',
  ] },
  { title: '留下属于你的传承', tag: '永久', items: [
    '冒险结束时按结算获得灵魂碎片，胜利离开与战败会明确区分。结算页显示本次实际获得的碎片。',
    '永久升级对之后开始的新冒险生效，可提升初始生命、攻击倍率，并解锁初始强化选择。',
    '击败怪物解锁图鉴。每累计 5 次击杀可领取该怪物的图鉴奖励；探索进度还提供额外的永久奖励，具体数值见图鉴。',
  ] },
]
</script>

<template>
  <view class="ui-overlay ui-sheet-overlay rules-overlay" @click="emit('close')">
    <view class="ui-sheet rules-panel" @click.stop>
      <view class="ui-sheet-header"><view><text class="ui-kicker">冒险指南</text><text class="ui-sheet-title">让每一步都有意义</text></view><button role="button" class="ui-close" @click="emit('close')">关闭</button></view>
      <view class="rules-summary"><view class="rules-principle"><text class="stat-attack">合并 → 蓄力</text><text class="stat-defense">总和 → 防御</text><text class="stat-speed">空格 → 速度</text></view><text class="ui-note">先看基准预估，再决定继续合并或结束回合。</text></view>
      <scroll-view class="ui-scroll" scroll-y>
        <view v-for="(section, index) in sections" :key="section.title" class="rules-section">
          <button role="button" class="rules-section-toggle" @click="openSection = openSection === index ? -1 : index"><view><text class="rules-tag">{{ section.tag }}</text><text class="rules-section-title">{{ section.title }}</text></view><text class="rules-toggle-sign">{{ openSection === index ? '−' : '+' }}</text></button>
          <view v-if="openSection === index" class="rules-items"><view v-for="(item, itemIndex) in section.items" :key="itemIndex" class="rules-item"><text class="rules-dot">{{ (itemIndex + 1).toString().padStart(2, '0') }}</text><text class="rules-text">{{ item }}</text></view></view>
        </view>
        <view class="rules-bottom" />
      </scroll-view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.rules-overlay { z-index: 120; }
.rules-summary { padding: 18rpx 20rpx; background: var(--surface-soft); border: 1px solid var(--line); border-radius: 14rpx; margin-bottom: 22rpx; }
.rules-principle { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12rpx; font-size: 26rpx; font-weight: 700; margin-bottom: 10rpx; }
.rules-section { border-bottom: 1px solid var(--line); }
.rules-section-toggle { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; width: 100%; padding: 24rpx 0; margin: 0; background: none; text-align: left; color: var(--text); border-radius: 0; line-height: 1.5; }
.rules-section-toggle::after { border: none; }
.rules-tag { font-size: 24rpx; color: var(--accent); margin-right: 18rpx; }
.rules-section-title { font-size: 30rpx; font-weight: 700; }
.rules-toggle-sign { font-size: 34rpx; color: var(--accent); }
.rules-items { padding-bottom: 12rpx; }
.rules-item { display: flex; align-items: flex-start; gap: 16rpx; margin: 4rpx 0 22rpx; }
.rules-dot { width: 34rpx; flex-shrink: 0; color: var(--accent); font-size: 24rpx; line-height: 1.9; }
.rules-text { color: var(--muted); font-size: 28rpx; line-height: 1.75; }
.rules-bottom { height: 32rpx; }
</style>
