<script setup lang="ts">
defineEmits<{ close: [] }>()
interface RuleSection { title: string; items: string[] }
const sections: RuleSection[] = [
  { title: '2048 基础操作', items: [
    '棋盘为 **4×4** 网格，向**上下左右**滑动操作',
    '相同数字碰撞后合并：**2+2→4**、**4+4→8**、**8+8→16**，以此类推',
    '每次滑动后，空格随机生成新方块（!!90% 为 2，10% 为 4!!）',
    '棋盘满且无相邻相同数字时，游戏进入困境',
  ]},
  { title: '战斗系统', items: [
    '每回合有 !!6 步!! 操作机会，用完或手动进入 !!结算!!',
    '**每次合并产生的数值** 累积为 !!攻击值!!（合并大了才疼）',
    '**棋盘所有方块数值之和** 为 !!防御值!!（保留高方块=防高）',
    '**空格数** 决定 !!速度!!（空格多=快=先手，基础 3 + 装备速度）',
    '博弈核心：!!合并!! 清空格 → 攻↑ 防↓ 速↑ / !!保留!! → 攻↓ 防↑ 速↓',
    '结算伤害公式：',
    '　**攻击值** × 攻击倍率 − 敌人防御 + !!固定攻击!! = ++对敌伤害++',
    '　敌攻击 − !!防御值!! − !!固定防御!! = ++自身受伤++（防御值 = 盘面总和 × 防御倍率 × (1+减伤%) / 6）',
    '防御值减伤上限 70%，固定攻/防来自套装装备',
    '速度高者先手，先手击杀则敌人 __无法反击__',
    '溢出伤害可转为 !!额外金币（1:1）!! 或 ``额外经验（2:1 减半）``',
  ]},
  { title: '装备系统', items: [
    '共 **5 个部位**：头盔、铠甲、手套、护腿、战靴',
    '套装装备（20 套）：!!固定属性!!，集齐 2/3/5 件可激活套装效果',
    '　如暴风套 2 件加速、5 件每回合多 2 步；噬血套 3 件吸血',
    '非套装装备（15 款）：!!随机属性!!，品质越高属性条越多',
    '　普通 1~2 条 / 稀有 2~3 条 / 史诗 3~4 条',
    '所有装备数值有 **±30% 波动**，同一装备可能爆出不同数值',
    '装备属性：!!攻击!! !!防御!!（百分比加成）、速度（固定值）、生命（固定值）',
    '装备等级随地图阶段提升，等级越高基础值越大',
    '背包可随时整理：按品质→部位→等级排序',
  ]},
  { title: '敌人与奖励', items: [
    '敌人分三阶段专属池，阶段越高越强，每回合敌人属性 !!上涨!!',
    '击败敌人获得 !!经验值!! 和 **金币**，并有概率掉落装备',
    '敌人品质越高（精英/Boss），掉落装备稀有度越高',
    '击杀解锁 !!图鉴!!，每 5 杀可领取金币奖励，全图鉴额外奖励生命和攻击',
  ]},
  { title: '等级与强化', items: [
    '升级后从 3 个随机强化中选择 1 个',
    '强化包括：攻击提升、生命上限增加、每回合回血、暴击、额外步数等',
    '开局可从 3 个初始强化中选择 1 个',
    '强化可叠加——选择同一强化的次数越多效果越强',
  ]},
  { title: '商店系统', items: [
    '路线地图中的 **⬟ 商店节点** 可用金币购买 !!强化!! 和 !!装备!!',
    '商品定价：普通 20G / 稀有 50G / 史诗 80G',
    '可花费金币刷新商品（10G 起），或移除不想要的强化（30G）',
    '商店也有概率出现 ``恢复药水``，直接回复生命',
  ]},
  { title: '地图与阶段', items: [
    '每阶段 **10 层**，由下往上攀登',
    '节点：__战斗__（最多）、**商店**（3/6/9 层固定）、++休息++（回复 30% HP）、__精英__（高难高奖）',
    '第 11 层 !!Boss!!，击败后可选择：',
    '　**继续攀登** → 进入下一阶段，敌人全面增强',
    '　**结算离开** → 结束冒险，获得``灵魂碎片``',
    '第 4 阶段起进入 ++无尽模式++，怪物属性持续增长',
    '每层只能选一个节点，不可回头',
  ]},
  { title: '永久升级', items: [
    '冒险结束获得``灵魂碎片``，在主菜单``永久升级``中消费',
    '永久强化包括：初始血量、初始攻击倍率、初始防御倍率等',
    '永久升级对所有新冒险生效',
  ]},
]
const TAGS = [ { marker: '**', cls: 'rules-gold' }, { marker: '__', cls: 'rules-red' }, { marker: '!!', cls: 'rules-blue' }, { marker: '++', cls: 'rules-green' }, { marker: '^^', cls: 'rules-purple' }, { marker: '``', cls: 'rules-cyan' } ]
function parseText(text: string) {
  const parts: { text: string; style?: string }[] = []; let remaining = text
  while (remaining.length > 0) {
    let earliest: { index: number; marker: string; cls: string } | null = null
    for (const tag of TAGS) { const idx = remaining.indexOf(tag.marker); if (idx !== -1 && (earliest === null || idx < earliest.index)) earliest = { index: idx, marker: tag.marker, cls: tag.cls } }
    if (earliest === null) { parts.push({ text: remaining }); break }
    if (earliest.index > 0) parts.push({ text: remaining.slice(0, earliest.index) })
    const afterOpen = earliest.index + earliest.marker.length; const closeIdx = remaining.indexOf(earliest.marker, afterOpen)
    if (closeIdx === -1) { parts.push({ text: remaining.slice(earliest.index) }); break }
    parts.push({ text: remaining.slice(afterOpen, closeIdx), style: earliest.cls }); remaining = remaining.slice(closeIdx + earliest.marker.length)
  }
  return parts
}
</script>
<template>
  <view class="rules-overlay" @click="$emit('close')">
    <view class="rules-panel" @click.stop>
      <view class="rules-header"><text class="rules-title">游戏规则</text><view class="rules-close" @click="$emit('close')"><text>✕</text></view></view>
      <scroll-view class="rules-body" scroll-y>
        <view v-for="(sec, i) in sections" :key="i" class="rules-section">
          <text class="rules-section-title">{{ sec.title }}</text>
          <view v-for="(item, j) in sec.items" :key="j" class="rules-item"><text class="rules-dot">•</text><text class="rules-text"><template v-for="(p, k) in parseText(item)" :key="k"><text v-if="p.style" :class="p.style">{{ p.text }}</text><text v-else>{{ p.text }}</text></template></text></view>
        </view>
      </scroll-view>
      <view class="rules-footer"><text class="rules-footer-text">点击空白处关闭</text></view>
    </view>
  </view>
</template>
<style lang="scss">
.rules-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: flex-end; z-index: 80; }
.rules-panel { width: 100%; max-height: 75vh; background: #1a1a2e; border-radius: 24rpx 24rpx 0 0; padding: 24rpx 20rpx 40rpx; display: flex; flex-direction: column; }
.rules-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.rules-title { font-size: 30rpx; font-weight: bold; color: #f1c40f; } .rules-close { padding: 8rpx; color: #888; font-size: 28rpx; }
.rules-body { flex: 1; } .rules-section { margin-bottom: 20rpx; }
.rules-section-title { font-size: 24rpx; font-weight: bold; color: #ccc; display: block; margin-bottom: 8rpx; }
.rules-item { display: flex; gap: 8rpx; padding: 6rpx 0; } .rules-dot { font-size: 22rpx; color: #f1c40f; width: 24rpx; flex-shrink: 0; }
.rules-text { font-size: 22rpx; color: #888; line-height: 34rpx; }
.rules-gold { color: #f1c40f; } .rules-red { color: #e74c3c; } .rules-blue { color: #3498db; } .rules-green { color: #2ecc71; } .rules-purple { color: #9b59b6; } .rules-cyan { color: #1abc9c; }
.rules-footer { margin-top: 20rpx; text-align: center; } .rules-footer-text { font-size: 20rpx; color: #555; }
</style>
