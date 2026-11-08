<script setup lang="ts">
import { inject, ref } from 'vue'
import { CARD_CLASSES } from '../core/upgrade'
import { cardClassHelp } from '../utils/displayText'
import { CARD_CLASS_SYMBOLS } from '../utils/artwork'
import ExpandPanel from './ExpandPanel.vue'
const emit = defineEmits<{ close: [] }>()
const reduced = inject('motionReduced', ref(false))
const openSection = ref(-1)
const sections = [
  { title: '怎么操作', items: [
    '上下左右滑动，相同数字合并。每个方块一次滑动最多合并一次；网页也支持方向键。',
    '基础每回合6步。只有棋盘发生移动才耗一步并生成方块；新方块90%为2、10%为4。不能移动或想提前结算时，点「结束本回合」。',
    '下一回合方块数值减半，最低为2，攻击重新积攒。',
  ] },
  { title: '卡牌和道具', items: [
    '白、蓝、金卡是常规奖励。红卡的收益和代价一起生效，不能只领收益。',
    '紫卡可用净化药剂或特定奇遇移除一层；黑卡本局不可解除。黑卡奇遇先确认代价，再另点「继续前进」才生效。',
    '持续卡可以叠加。治疗卡立即使用，不加入持有列表；攻击造成伤害才会触发吸血。',
    '道具购买后存入背包，每次使用一件。药剂在本回合有效、卷轴在本场战斗有效；只能在战斗操作时使用。净化药剂只在路线、商店、营地使用，事件结果未确认时不能使用。',
    '赠送方块点数每回合发放，没空位会留到之后，腾出空位再补放。',
  ] },
  { title: '装备与成长', items: [
    '装备进入背包后，点击装备来更换对应部位。战斗中、事件结果等待确认时不能换装。套装集齐2、3、5件时分别激活效果。',
    '装备的普通、稀有、史诗品质与卡牌颜色无关，紫框史诗装备不是诅咒。套装攻击、防御是固定值，独立装备是百分比；生命、速度是固定值。',
    '胜利获得金币和经验，并可能掉落装备。升级、精英与首领会带来强化选择，多份奖励依次领取；跳过只跳过当前一份。',
    '击杀时剩余的基础6步，每步奖励2金币；额外步数、之前回合和战败都不奖励。溢出伤害可选换金币（1:1）或经验（2:1，向下取整）。',
  ] },
  { title: '路线与补给', items: [
    '沿地图虚线从下往上走，每层只选一条路，不能回头。墨色「刚完成」是来时的路标，金色「可前往」是下一步的选择。商店与营地在选定下一层前可以离开再进。每阶段10层，第11层是首领。',
    '营地只用一次：治疗，以生命上限的30%计算，再扣除治疗减少的影响，不超过上限；满血也可休整。紫卡要用净化药剂或特定奇遇移除，营火不负责净化。',
    '商店里点击商品即可查看效果、属性与价格，确认后在弹窗内购买；刷新会更新所有商品，离开再进不重置货架。移除强化每店一次；紫卡要净化，黑卡本局不可解除。',
    '共有25种奇遇，按阶段逐步解锁。新增奇遇有4～5个选项，每次只能选一项；先看风险和消耗，再确认结算。随机结果只抽取一次，确认不会重新抽取。',
    '断咒祭坛可支付生命或金币净化紫卡，也可购买净化药剂留待之后使用；事件净化按持有列表顺序先减少首张紫卡的层数，黑卡始终不能解除。',
    '敌人从第3回合开始成长；第2阶段起可能带能力，第4阶段起进入无尽模式。',
  ] },
  { title: '进阶计算', advanced: true, items: [
    '基础合并攻击＝合并结果数值×（1＋合并攻击加成）×（1＋爆发加成）。再加连锁攻击，整体除以（1＋攻击散失总量）；已有攻击不受后续散失变化影响。没合并攻击时，即使有固定攻击也不会出手。',
    '总防御＝向下取整（棋盘总和×实际防御倍率÷6＋本回合新方块数值×新方块防御加成＋合并获得的防御＋上回合留下的防御）＋装备固定防御。新方块加成不放大整个棋盘。',
    '敌人攻击的基础伤害＝向上取整（敌攻×15÷（15＋总防御）），正攻击至少造成1点伤害。易伤、首击守护、闪避等另外结算。',
    '对敌伤害还会计算攻击倍率、固定攻击、敌人防御，以及套装穿透和守护等；面板预估与战斗共用计算。',
    '速度＝实际基础速度＋空格数。速度高者先手，同速玩家先手；先手套装可改变顺序。先手击杀会阻止对方攻击。',
    '防御保留、吸血、追加攻击机会、治疗减少和攻击散失的实际比例＝总量÷（1＋总量），不能直接把卡上的增量当成百分比。防御只保留合并获得和之前留下的部分。吸血按实际造成伤害计算，装备吸血另加且总比例不超过100%。',
    '普通治疗＝向下取整（原始回复量÷（1＋治疗减少总量）），再限制到缺失生命。营地先将生命上限×30%向下取整。',
    '追加攻击每回合最多一次，双方仍存活才抽签；触发时才有反噬。流血、灼烧在回合结束损失生命，滑动发生合并时触发噬魂。负面损血可以致死，死亡后不能靠回复复活。',
    '连续发生合并的移动增加连锁，没合并就归零。闪避和敌人停手都不是保证触发。没有合并的回合不会触发套装再生。',
  ] },
  { title: '永久升级', items: [
    '冒险结算获得灵魂碎片，永久升级对下一次冒险生效，可提升初始生命、攻击并解锁初始强化。',
    '击败怪物解锁图鉴，每累计5次击杀可领取一次奖励；探索奖励以图鉴显示为准。',
  ] },
]
</script>

<template>
  <view class="ui-overlay ui-sheet-overlay rules-overlay" @click="emit('close')">
    <view class="ui-sheet rules-panel" @click.stop>
      <view class="ui-sheet-header"><view><text class="ui-kicker">冒险指南</text><text class="ui-sheet-title">先记住这四件事</text></view><button role="button" class="ui-close ui-press" @click="emit('close')">关闭</button></view>
      <view class="rules-summary">
        <text class="rules-principle stat-attack">合并数字，积攒攻击</text><text class="rules-principle stat-defense">棋盘数字越多，防御越强</text><text class="rules-principle stat-speed">空格越多，速度越快</text><text class="rules-principle">步数用完或提前结束，双方交战</text>
        <text class="ui-note">点属性或卡牌查看说明，不必先记公式。</text>
      </view>
      <scroll-view class="ui-scroll" scroll-y>
        <view v-for="(section, index) in sections" :key="section.title" class="rules-section">
          <button role="button" class="rules-section-toggle ui-press" :aria-expanded="openSection === index" @click="openSection = openSection === index ? -1 : index"><text class="rules-section-title">{{ section.title }}</text><text class="rules-toggle-sign">{{ openSection === index ? '−' : '+' }}</text></button>
          <ExpandPanel :open="openSection === index" :revision="section.title" :reduced="reduced">
            <view class="rules-items"><view v-for="(item, itemIndex) in section.items" :key="itemIndex" class="rules-item"><text class="rules-dot">·</text><text class="rules-text">{{ item }}</text></view></view>
            <view v-if="index === 1" class="rules-class-key"><view v-for="cardClass in CARD_CLASSES" :key="cardClass" class="rules-class card-tone" :class="`card-${cardClass}`"><text class="ui-note">{{ CARD_CLASS_SYMBOLS[cardClass] }} {{ cardClassHelp(cardClass) }}</text></view></view>
          </ExpandPanel>
        </view>
        <view class="rules-bottom" />
      </scroll-view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.rules-overlay { z-index: 120; }
.rules-summary { padding: 18rpx 20rpx; background: var(--surface-soft); border: 1px solid var(--line); border-radius: 14rpx; margin-bottom: 14rpx; }
.rules-principle { display: block; font-size: 27rpx; font-weight: 700; margin-bottom: 8rpx; color: var(--text); }
.rules-class-key { display: flex; flex-direction: column; gap: 10rpx; margin-bottom: 16rpx; }
.rules-class { border-left: 4rpx solid var(--card-color); padding: 10rpx 14rpx; background: var(--surface-soft); }
.rules-section { border-bottom: 1px solid var(--line); }
.rules-section-toggle { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; width: 100%; padding: 22rpx 0; margin: 0; background: none; text-align: left; color: var(--text); border-radius: 0; line-height: 1.5; }
.rules-section-toggle::after { border: none; }
.rules-section-title { font-size: 28rpx; font-weight: 700; }
.rules-toggle-sign { font-size: 32rpx; color: var(--accent); }
.rules-items { padding-bottom: 8rpx; }
.rules-item { display: flex; align-items: flex-start; gap: 12rpx; margin: 4rpx 0 18rpx; }
.rules-dot { flex-shrink: 0; color: var(--accent); font-size: 26rpx; line-height: 1.7; }
.rules-text { color: var(--muted); font-size: 26rpx; line-height: 1.7; }
.rules-bottom { height: 32rpx; }
</style>
