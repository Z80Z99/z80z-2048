<script setup lang="ts">
import { ref } from 'vue'
const emit = defineEmits<{ close: [] }>()
// 关闭动画：先播滑出，250ms 后再真正关闭
const closing = ref(false)
let closeTimer: any = null
function close() {
  if (closing.value) return
  closing.value = true
  closeTimer = setTimeout(() => emit('close'), 250)
}
interface RuleSection { title: string; items: string[] }
const sections: RuleSection[] = [
  { title: '2048 基础操作', items: [
    '棋盘为 **4×4** 网格，向**上下左右**滑动操作',
    '相同数字碰撞后合并：**2+2→4**、**4+4→8**、**8+8→16**，以此类推',
    '每次滑动后，空格随机生成新方块（!!90% 为 2，10% 为 4!!）',
    '棋盘满且无法合并时无法滑动，只能!!提前结束!!本回合',
  ]},
  { title: '战斗系统', items: [
    '每回合基础 !!6 步!! 操作机会（强化/装备可增加），用完或手动进入 !!结算!!',
    '**每次合并产生的数值** 累积为 !!攻击值!!（合并大了才疼）',
    '**棋盘所有方块数值之和** 为 !!防御值!!（保留高方块=防高）',
    '**空格数** 决定 !!速度!!（空格多=快=先手，基础 3 + 装备速度）',
    '博弈核心：!!合并!! 清空格 → 攻↑ 防↓ 速↑ / !!保留!! → 攻↓ 防↑ 速↓',
    '!!回合结算后：棋盘所有方块减半!!（向下取整、最小为 2）——下回合从减半棋盘继续',
    '提前结束回合：剩余步数 ×2 的 !!金币奖励!!，并立即结算本回合',
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
    '装备属性：!!攻击!! !!防御!!（百分比加成）、速度/生命（固定值）、金币/经验（加成）',
    '装备等级随地图阶段提升，等级越高基础值越大',
    '背包可随时整理：按品质→部位→等级排序',
  ]},
  { title: '敌人与奖励', items: [
    '敌人分三阶段专属池，阶段越高越强，每回合敌人属性 !!上涨!!',
    '第 2 阶段起，敌人会随机携带 !!强化卡!!，属性全面提升',
    '击败敌人获得 !!经验值!! 和 **金币**，并有概率掉落装备',
    '精英/Boss 的金币与经验有 !!倍数加成!!（精英 ×2 / Boss ×3）',
    '敌人品质越高（精英/Boss），掉落装备稀有度越高',
    '击杀解锁 !!图鉴!!，每 5 杀可领取金币奖励，全图鉴额外奖励生命和攻击',
  ]},
  { title: '等级与强化', items: [
    '升级后从 3 个随机强化中选择 1 个',
    '强化包括：攻击/防御倍率提升、恢复生命、生命上限增加、额外步数、开局高价值方块、生成减伤、削弱敌人、金币加成等',
    '强化卡分 !!普通/稀有/史诗!! 三档：史诗效果更强，叠加上限更低',
    '生命值低于一半时，奖励池会 !!优先出现治疗卡!!',
    '开局可从 3 个初始强化中选择 1 个',
    '强化可叠加——选择同一强化的次数越多效果越强',
  ]},
  { title: '商店系统', items: [
    '路线地图中的 **⬟ 商店节点** 可用金币购买 !!强化!! 和 !!装备!!',
    '强化卡定价：普通 20G / 稀有 50G / 史诗 80G；装备定价：普通 30G / 稀有 70G / 史诗 120G',
    '可花费金币刷新商品（10G 起），或移除不想要的强化（30G）',
    '商店固定提供 1 个 ``恢复药水``（按回复量 ×1.5 定价），直接回复生命',
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
    '永久强化包括：初始生命、初始攻击倍率，以及开局多一次强化选择',
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
  <view class="rules-overlay" :class="{ closing }" @click="close()">
    <view class="rules-panel" :class="{ closing }" @click.stop>
      <view class="rules-header"><text class="rules-title">游戏规则</text><view class="rules-close" @click="close()"><text>✕</text></view></view>
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
.rules-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: flex-end; z-index: 80; animation: fade-in 0.2s ease-out; }
.rules-panel { width: 100%; height: 75vh; background: #1a1a2e; border-radius: 24rpx 24rpx 0 0; padding: 24rpx 20rpx 40rpx; display: flex; flex-direction: column; animation: panel-rise 0.3s cubic-bezier(0.22,0.99,0.38,1.02); }
.rules-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.rules-title { font-size: 30rpx; font-weight: bold; color: #f1c40f; } .rules-close { padding: 8rpx; color: #888; font-size: 28rpx; }
.rules-body { flex: 1; height: 0; } .rules-section { margin-bottom: 20rpx; }
.rules-section-title { font-size: 24rpx; font-weight: bold; color: #ccc; display: block; margin-bottom: 8rpx; }
.rules-item { display: flex; gap: 8rpx; padding: 6rpx 0; } .rules-dot { font-size: 22rpx; color: #f1c40f; width: 24rpx; flex-shrink: 0; }
.rules-text { font-size: 22rpx; color: #888; line-height: 34rpx; }
.rules-gold { color: #f1c40f; } .rules-red { color: #e74c3c; } .rules-blue { color: #3498db; } .rules-green { color: #2ecc71; } .rules-purple { color: #9b59b6; } .rules-cyan { color: #1abc9c; }
.rules-footer { margin-top: 20rpx; text-align: center; } .rules-footer-text { font-size: 20rpx; color: #555; }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes panel-rise { from { transform: translateY(50%); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
.rules-overlay.closing { animation: fade-out 0.25s ease-in forwards; }
.rules-panel.closing { animation: panel-exit 0.25s ease-in forwards; }
@keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes panel-exit { from { transform: translateY(0); opacity: 1; } to { transform: translateY(50%); opacity: 0.6; } }
</style>
