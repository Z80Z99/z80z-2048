<script setup lang="ts">
import { ref, computed, inject, watch, nextTick } from 'vue'
import { useModalMotion } from '../../composables/usePanelMotion'
import ExpandPanel from '../ExpandPanel.vue'
import { useGameStore } from '../../store/gameStore'
import { computeEquipBonuses } from '../../core/equipment'
import { layoutRoute } from '../../core/routeLayout'
import { routeProgressText } from '../../utils/routeProgress'
import CardIcon from '../CardIcon.vue'
import CardDetails from '../CardDetails.vue'
import { CARD_CLASS_SYMBOLS } from '../../utils/artwork'
import MapIcon from '../MapIcon.vue'
import type { LayoutNode, RouteSegment } from '../../core/routeLayout'
import type { RouteNode, NodeType } from '../../types'

const store = useGameStore()
const player = computed(() => store.effectivePlayer)
const maxTurns = computed(() => player.value.baseMaxTurns + player.value.bonusTurns + computeEquipBonuses(store.player.equipment).setEffects.extraTurns)
const showPanel = ref(false)
const showUpgrades = ref(false)
const reduced = inject('motionReduced', ref(false))
const showAttributeHelp = inject<(key: string) => void>('show-attribute-help', () => {})
const legendMotion = useModalMotion(reduced)
const previewMotion = useModalMotion(reduced)
const upgradeMotion = useModalMotion(reduced)
const upDetail = ref<string | null>(null)
const previewId = ref<string | null>(null)
const scrollTarget = ref('')
const stageName = computed(() => store.stage === 1 ? '地牢入口' : store.stage === 2 ? '深渊回廊' : store.stage === 3 ? '终焉之间' : '无尽深渊')
const nodeConfig: Record<NodeType, { label: string; description: string }> = {
  start: { label: '入口', description: '旅途从这里开始。' },
  battle: { label: '战斗', description: '迎战守卫，胜利后继续攀登。' },
  elite: { label: '精英', description: '强敌盘踞的险路，谨慎准备再出发。' },
  event: { label: '事件', description: '未知的机遇与抉择，进入后揭晓。' },
  shop: { label: '商店', description: '用金币购买补给、强化与装备。' },
  rest: { label: '休息', description: '营火休整：治疗（按生命上限的30%计算，受治疗减少影响），只此一项；选定下一层前可以离开再来。' },
  boss: { label: '首领', description: '本阶段的最后一道关卡。' },
}
const legendTypes: NodeType[] = ['battle', 'elite', 'event', 'rest', 'shop', 'boss']
const routeMap = computed(() => layoutRoute(store.route, store.currentNodeId))
const nextNodes = computed(() => store.route.filter(node => node.accessible && !node.completed && node.id !== store.currentNodeId))
const activeNode = computed(() => nextNodes.value[0])
const currentNode = computed(() => store.route.find(node => node.id === store.currentNodeId))
const focusLayer = computed(() => activeNode.value?.layer ?? currentNode.value?.layer ?? 1)
// 刚走完的路标仍留着 currentNodeId；用“已完成”而不是“当前位置”，避免和下一层混淆。
const finishedLayer = computed(() => currentNode.value?.completed ? currentNode.value.layer : null)
const routeProgress = computed(() => routeProgressText(focusLayer.value, finishedLayer.value, nextNodes.value.length))
const selectedUpgrade = computed(() => store.upgrades.find(upgrade => upgrade.def.id === upDetail.value))
const preview = computed(() => routeMap.value.nodes.find(placed => placed.node.id === previewId.value))
const canEnter = computed(() => !!preview.value && preview.value.node.accessible && !preview.value.node.completed && store.screen === 'route' && !store.runOutcome)
const hpPercent = computed(() => Math.max(0, Math.min(100, player.value.hp / Math.max(1, player.value.maxHp) * 100)))
const xpPercent = computed(() => Math.max(0, Math.min(100, player.value.xp / Math.max(1, player.value.xpToNext) * 100)))
const completedCount = computed(() => store.route.filter(node => node.completed).length)
function nodeName(node: RouteNode) {
  return node.enemy && ['battle', 'elite', 'boss'].includes(node.type) ? node.enemy.name
    : node.type === 'rest' ? '营火休整' : node.type === 'shop' ? '旅途补给' : node.type === 'event' ? '未知的机遇' : '旅途入口'
}
// 商店与营地可在选定下一层前反复进出；这类“当前路标”显示可再次进入而不是刚完成。
function isReenterable(placed: LayoutNode) {
  return placed.node.accessible && ['shop', 'rest'].includes(placed.node.type)
}
function stateLabel(placed: LayoutNode) {
  if (placed.state === 'current' && isReenterable(placed)) return '可再次进入'
  return { current: '刚完成', visited: '已经过', available: '可前往', future: '尚未到达', abandoned: '未选路线' }[placed.state]
}
function nodeStyle(placed: LayoutNode) {
  const boss = placed.node.type === 'boss'
  return { left: `${placed.x - (boss ? 73 : 52)}rpx`, top: `${placed.y - placed.radius}rpx` }
}
function lineStyle(segment: RouteSegment) {
  return { left: `${segment.x}rpx`, top: `${segment.y}rpx`, width: `${segment.length}rpx`, transform: `rotate(${segment.angle}deg)` }
}
async function focusCurrent() {
  scrollTarget.value = ''
  await nextTick()
  scrollTarget.value = `route-floor-${focusLayer.value}`
}
function openPreview(id: string) {
  if (previewMotion.closing.value) return
  previewId.value = id
  previewMotion.open()
}
function openUpgrade(id: string) {
  if (upgradeMotion.closing.value) return
  upDetail.value = id
  upgradeMotion.open()
}
watch(previewMotion.mounted, mounted => { if (!mounted) previewId.value = null })
watch(upgradeMotion.mounted, mounted => { if (!mounted) upDetail.value = null })
function enterPreview() {
  if (previewMotion.closing.value || !canEnter.value || !preview.value) return
  const id = preview.value.node.id
  store.SELECT_NODE(id)
  previewMotion.close()
}
watch(() => `${store.stage}:${focusLayer.value}:${store.currentNodeId}`, focusCurrent, { immediate: true })
</script>

<template>
  <view class="route-page">
    <view class="route-shell">
      <view class="route-header">
        <view><text class="route-kicker">远征手记 / 第 {{ store.stage }} 阶段</text><text class="route-title">{{ stageName }}</text></view>
        <button role="button" class="route-panel-toggle" :aria-expanded="showPanel" @click="showPanel = !showPanel">{{ showPanel ? '收起属性' : '查看属性' }}</button>
      </view>
      <view class="route-resource-row">
        <view class="route-health ui-press" role="button" tabindex="0" @click="showAttributeHelp('player.hp')"><view class="route-between"><text class="route-label">生命</text><text class="route-health-value">{{ player.hp }} / {{ player.maxHp }}</text></view><view class="route-track"><view class="route-hp-fill" :style="{ width: `${hpPercent}%` }" /></view></view>
        <view class="route-gold ui-press" role="button" tabindex="0" @click="showAttributeHelp('player.gold')"><text class="route-label">金币</text><text class="route-resource-value">{{ player.gold }}</text></view>
        <view class="route-level ui-press" role="button" tabindex="0" @click="showAttributeHelp('player.xp')"><text class="route-label">Lv.{{ player.level }}</text><text class="route-xp-text">{{ player.xp }}/{{ player.xpToNext }} XP</text><view class="route-track route-xp-track"><view class="route-xp-fill" :style="{ width: `${xpPercent}%` }" /></view></view>
      </view>
      <ExpandPanel :open="showPanel" :revision="`${player.hp}:${player.maxHp}:${store.upgrades.length}`" :reduced="reduced"><view class="route-player">
        <view class="route-stats">
          <view role="button" tabindex="0" class="route-stat ui-press" @click="showAttributeHelp('player.attack')"><text class="route-label">攻击</text><text class="route-stat-value">×{{ player.attackMultiplier.toFixed(2) }}</text><text v-if="player.flatAttack" class="route-stat-extra">固定 +{{ player.flatAttack }}</text></view>
          <view role="button" tabindex="0" class="route-stat ui-press" @click="showAttributeHelp('player.defense')"><text class="route-label">防御</text><text class="route-stat-value">×{{ player.defenseMultiplier.toFixed(2) }}</text><text v-if="player.flatDefense" class="route-stat-extra">固定 +{{ player.flatDefense }}</text></view>
          <view role="button" tabindex="0" class="route-stat ui-press" @click="showAttributeHelp('player.speed')"><text class="route-label">基础速度</text><text class="route-stat-value">{{ Number(player.baseSpeed.toFixed(2)) }}</text></view>
          <view role="button" tabindex="0" class="route-stat ui-press" @click="showAttributeHelp('player.steps')"><text class="route-label">回合步数</text><text class="route-stat-value">{{ maxTurns }}</text></view>
        </view>
        <view class="route-buffs-row"><button role="button" class="route-up-toggle ui-press" :aria-expanded="showUpgrades" @click="showUpgrades = !showUpgrades">本局强化 {{ store.upgrades.length }} 项 · {{ showUpgrades ? '收起' : '查看' }}</button></view>
      </view></ExpandPanel>
      <ExpandPanel :open="showPanel && showUpgrades" :revision="store.upgrades.map(upgrade => `${upgrade.def.id}:${upgrade.count}`).join(',')" :reduced="reduced"><view class="route-player"><scroll-view class="route-up-scroll" scroll-y>
          <text v-if="!store.upgrades.length" class="route-note">还未获得强化，升级与探索都能带来新的选择。</text>
          <view class="route-up-list"><button role="button" v-for="upgrade in store.upgrades" :key="upgrade.def.id" class="route-up-chip card-tone ui-press" :class="`card-${upgrade.def.cardClass}`" @click="openUpgrade(upgrade.def.id)">{{ CARD_CLASS_SYMBOLS[upgrade.def.cardClass] }} {{ upgrade.def.name }} ×{{ upgrade.count }}</button></view>
        </scroll-view></view></ExpandPanel>
      <view class="route-map-heading">
        <view><text class="route-map-caption">向上攀登</text><text class="route-map-instruction">点选路标查看 · 确认后进入</text></view>
        <view class="route-map-actions"><button role="button" class="route-current-btn" @click="focusCurrent">定位进度</button><button role="button" class="route-legend-btn" @click="legendMotion.open()">图例</button></view>
      </view>
      <scroll-view class="route-map" scroll-y :scroll-into-view="scrollTarget" :scroll-with-animation="false">
        <view class="route-map-content" :style="{ height: `${routeMap.height}rpx` }">
          <view class="route-summit"><text>终点</text><view class="route-summit-rule" /></view>
          <view class="route-paths" aria-hidden="true">
            <template v-for="edge in routeMap.edges" :key="edge.id">
              <view v-for="(segment, index) in edge.segments" :key="`${edge.id}-${index}`" class="route-path" :class="`path-${edge.state}`" :style="lineStyle(segment)" />
            </template>
          </view>
          <view v-for="floor in routeMap.floors" :id="`route-floor-${floor.layer}`" :key="`anchor-${floor.layer}`" class="route-scroll-anchor" :style="{ top: `${Math.max(0, floor.y - 228)}rpx` }" />
          <view v-for="floor in routeMap.floors" :key="`mark-${floor.layer}`" class="route-floor-mark" :class="{ 'floor-done': finishedLayer === floor.layer, 'floor-next': focusLayer === floor.layer }" :style="{ top: `${floor.y - 10}rpx` }"><text>{{ String(floor.layer).padStart(2, '0') }}</text></view>
          <button role="button" v-for="placed in routeMap.nodes" :key="placed.node.id" class="route-node" :class="[`route-node-${placed.node.type}`, `node-${placed.state}`]" :style="nodeStyle(placed)" :aria-label="`第 ${placed.node.layer} 层，${nodeConfig[placed.node.type].label}，${nodeName(placed.node)}，${stateLabel(placed)}，查看详情`" @click="openPreview(placed.node.id)">
            <view class="route-node-orbit">
              <MapIcon :type="placed.node.type" :active="placed.state === 'available'" :size="placed.node.type === 'boss' ? 'large' : 'normal'" />
            </view>
            <text class="route-node-label">{{ nodeConfig[placed.node.type].label }}</text>
            <text v-if="placed.state === 'available' || placed.state === 'current'" class="route-node-state">{{ placed.state === 'available' ? '可前往' : isReenterable(placed) ? '可再次进入' : '刚完成' }}</text>
          </button>
          <view class="route-map-origin"><view class="route-origin-rule" /><text>旅途起点</text><text class="route-origin-note">已踏过 {{ completedCount }} 处路标 · 每层只选一条路</text></view>
        </view>
      </scroll-view>
      <view class="route-map-footer"><view class="route-footer-dot" /><text>{{ routeProgress }}</text><text class="route-footer-scroll">上滑探索远方</text></view>
    </view>

    <view v-if="previewMotion.mounted.value && preview" class="ui-overlay route-overlay" :class="{ 'ui-motion-closing': previewMotion.closing.value }" @click="previewMotion.close()">
      <view class="ui-dialog route-sheet" role="dialog" aria-modal="true" :aria-label="`${nodeConfig[preview.node.type].label}详情`" @click.stop>
        <view class="route-sheet-header"><text class="route-kicker">第 {{ preview.node.layer }} 层 / {{ stateLabel(preview) }}</text><button role="button" class="route-sheet-close" @click="previewMotion.close()">关闭</button></view>
        <view class="route-preview-title"><MapIcon :type="preview.node.type" :active="canEnter" size="large" /><view><text class="route-preview-type">{{ nodeConfig[preview.node.type].label }}</text><text class="route-preview-name">{{ nodeName(preview.node) }}</text></view></view>
        <text class="route-preview-desc">{{ nodeConfig[preview.node.type].description }}</text>
        <view v-if="preview.node.enemy && ['battle', 'elite', 'boss'].includes(preview.node.type)" class="route-enemy-stats"><text>生命 {{ preview.node.enemy.hp }}</text><text>攻击 {{ preview.node.enemy.attack }}</text><text>防御 {{ preview.node.enemy.defense }}</text><text>速度 {{ Number(preview.node.enemy.speed.toFixed(2)) }}</text></view>
        <text class="route-preview-note">{{ canEnter ? '确认进入后，同层其他路线将不再可选。' : preview.state === 'current' ? (isReenterable(preview) ? '这个路标还可以再次进入；也可以直接往上选择金色路标。' : '这是你刚完成的路标。往上选择金色路标，继续下一层。') : preview.state === 'visited' ? '这段旅途已经走过。墨圈记录着你的足迹。' : preview.state === 'future' ? '这处路标尚未到达，先走完与你相连的路线。' : '这条路线与你目前的足迹不再相连，仅可查看。' }}</text>
        <button v-if="canEnter" role="button" class="route-enter-btn" @click="enterPreview">进入{{ nodeConfig[preview.node.type].label }}</button>
        <button v-else role="button" class="route-back-btn" @click="previewMotion.close()">返回地图</button>
      </view>
    </view>
    <view v-if="legendMotion.mounted.value" class="ui-overlay route-overlay" :class="{ 'ui-motion-closing': legendMotion.closing.value }" @click="legendMotion.close()">
      <view class="ui-dialog route-sheet" role="dialog" aria-modal="true" aria-label="地图图例" @click.stop>
        <view class="route-sheet-header"><view><text class="route-kicker">旅人的标记</text><text class="route-legend-title">地图图例</text></view><button role="button" class="route-sheet-close" @click="legendMotion.close()">关闭</button></view>
        <view class="route-legend-types"><view v-for="type in legendTypes" :key="type" class="route-legend-type"><MapIcon :type="type" /><text>{{ nodeConfig[type].label }}</text></view></view>
        <view class="route-legend-states"><view><view class="legend-state legend-available" /><text>金色路标 · 可前往下一层</text></view><view><view class="legend-state legend-current" /><text>双圈墨印 · 刚完成的一层</text></view><view><view class="legend-state legend-visited" /><text>手绘墨圈 · 已走过</text></view><view><view class="legend-line legend-future" /><text>淡墨虚线 · 未来相连的路线</text></view><view><view class="legend-line legend-abandoned" /><text>褪色路标与线 · 未选 / 不再相连</text></view></view>
        <text class="route-preview-note">沿虚线由下向上攀登。点任何路标可查看详情，只有当前可前往的路标可以确认进入。</text>
      </view>
    </view>
    <view v-if="upgradeMotion.mounted.value && selectedUpgrade" class="ui-overlay" :class="{ 'ui-motion-closing': upgradeMotion.closing.value }" @click="upgradeMotion.close()">
      <view class="ui-dialog" @click.stop>
        <view class="ui-sheet-header"><text class="ui-sheet-title">{{ selectedUpgrade.def.name }}</text><button role="button" class="ui-close" @click="upgradeMotion.close()">关闭</button></view>
        <CardIcon :icon="selectedUpgrade.def.icon" :card-class="selectedUpgrade.def.cardClass" />
        <CardDetails :card-class="selectedUpgrade.def.cardClass" :effects="selectedUpgrade.def.effects" :kind="selectedUpgrade.def.kind" :count="selectedUpgrade.count" :compact="false" :show-help="false" :context="{ modifiers: store.activeCardModifiers }" />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.route-page { height: var(--viewport-height); box-sizing: border-box; padding: 20rpx 24rpx calc(120rpx + var(--safe-bottom)); background: var(--bg); }
.route-shell { --paper: #eee3cb; --ink: #39362e; --faint-ink: #827867; --map-gold: #997027; width: 100%; height: 100%; max-width: 740rpx; margin: 0 auto; display: flex; flex-direction: column; overflow: hidden; color: var(--ink); border-radius: 5rpx 5rpx 14rpx 14rpx; border: 1rpx solid #ad9b76; box-shadow: 0 7rpx 24rpx #0003, inset 0 0 48rpx #a3824820; background-color: var(--paper); background-image: radial-gradient(ellipse at 3% 40%, #a9844930, transparent 43%), radial-gradient(ellipse at 93% 12%, #fff9e980, transparent 53%), repeating-radial-gradient(ellipse at 19% 27%, #79634304 0, #79634304 1rpx, transparent 2rpx, transparent 11rpx); }
.route-header { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; padding: 22rpx 26rpx 12rpx; flex-shrink: 0; }
.route-kicker { display: block; font-size: 20rpx; letter-spacing: 3rpx; color: #7a6951; line-height: 1.5; }
.route-title { display: block; font-size: 38rpx; font-weight: 800; letter-spacing: 4rpx; font-family: Georgia, 'Songti SC', 'STSong', serif; line-height: 1.45; }
.route-panel-toggle, .route-current-btn, .route-up-toggle, .route-legend-btn, .route-sheet-close { margin: 0; padding: 10rpx 12rpx; background: transparent; color: #675137; font-size: 23rpx; line-height: 1.5; border-radius: 4rpx; }
.route-panel-toggle::after, .route-current-btn::after, .route-up-toggle::after, .route-legend-btn::after, .route-sheet-close::after { border: none; }
.route-panel-toggle { border-bottom: 1rpx solid #9b876855; }
.route-resource-row { display: flex; gap: 22rpx; align-items: center; margin: 0 26rpx; padding-bottom: 16rpx; border-bottom: 1rpx solid #8c765744; flex-shrink: 0; }
.route-health { flex: 1.5; min-width: 0; }
.route-between { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 4rpx; margin-bottom: 6rpx; }
.route-label { display: block; font-size: 22rpx; color: #776b58; line-height: 1.4; }
.route-health-value { font-size: 26rpx; font-weight: 700; color: #7c4436; }
.route-track { height: 7rpx; background: #cabea5; border-radius: 2rpx; overflow: hidden; }
.route-hp-fill { height: 100%; background: #875447; }
.route-gold { flex: 0.65; text-align: center; }
.route-resource-value { display: block; font-size: 28rpx; font-weight: 800; color: #89641e; }
.route-level { flex: 1; }
.route-level .route-label { color: #4f493d; font-weight: 700; }
.route-xp-text { color: #756a57; font-size: 20rpx; }
.route-xp-track { height: 4rpx; margin-top: 6rpx; }
.route-xp-fill { height: 100%; background: #6a7257; }
.route-player { margin: 0 26rpx; padding-top: 10rpx; flex-shrink: 0; }
.route-stats { display: flex; gap: 8rpx; }
.route-stat { flex: 1; min-width: 0; display: flex; flex-direction: column; text-align: center; padding: 8rpx 2rpx; background: #7b653610; border-radius: 5rpx; }
.route-stat-value { font-size: 26rpx; font-weight: 800; }
.route-stat-extra { font-size: 20rpx; color: #776b58; }
.route-buffs-row { display: flex; align-items: center; justify-content: flex-end; gap: 10rpx; padding-top: 2rpx; }
.route-nerf { font-size: 22rpx; color: #7c4436; }
.route-up-scroll { height: 146rpx; margin: 8rpx 0; }
.route-up-list { display: flex; gap: 8rpx; flex-wrap: wrap; }
.route-up-chip { margin: 0; padding: 9rpx 12rpx; font-size: 23rpx; line-height: 1.4; color: #4f493d; background: #f6eedc; border-radius: 6rpx; }
.route-up-chip::after { border: 1rpx solid #b5a17d; }
.route-note { color: #776b58; font-size: 23rpx; }
.route-map-heading { display: flex; justify-content: space-between; align-items: center; gap: 8rpx; padding: 12rpx 20rpx 8rpx 26rpx; flex-shrink: 0; }
.route-map-caption { display: block; font-size: 25rpx; font-weight: 700; letter-spacing: 4rpx; }
.route-map-instruction { display: block; color: #87775d; font-size: 20rpx; line-height: 1.5; }
.route-map-actions { display: flex; align-items: center; gap: 8rpx; }
.route-current-btn, .route-legend-btn { border: 1rpx solid #a18c6766; background: #f8f0df55; min-width: 82rpx; }
.route-map { flex: 1; height: 0; min-height: 0; background-image: linear-gradient(90deg, #a7824020, transparent 12%, transparent 88%, #a7824018); }
.route-map-content { position: relative; width: 640rpx; max-width: 100%; margin: 0 auto; }
.route-paths { position: absolute; inset: 0; pointer-events: none; }
.route-path { position: absolute; height: 0; border-top: 3rpx dashed currentColor; transform-origin: 0 0; color: #8c8068; opacity: 0.64; }
.path-visited { color: #494337; opacity: 0.85; border-top-width: 4rpx; }
.path-available { color: #977025; opacity: 1; border-top-width: 4rpx; }
.path-future { color: #867960; opacity: 0.6; }
.path-abandoned { color: #9b8b70; opacity: 0.2; }
.route-scroll-anchor { position: absolute; left: 0; height: 1rpx; width: 1rpx; pointer-events: none; }
.route-floor-mark { position: absolute; left: 3rpx; color: #9b8b6c; font-size: 18rpx; font-family: Georgia, serif; letter-spacing: 1rpx; pointer-events: none; }
.floor-done { color: #5f5748; font-weight: 700; }
.floor-next { color: #89631f; font-weight: 800; }
.floor-next::after { content: ''; display: block; width: 20rpx; border-top: 2rpx solid #997027; margin-top: 5rpx; }
.route-summit { position: absolute; top: 22rpx; left: 50%; transform: translateX(-50%); text-align: center; color: #8c7654; font-size: 19rpx; letter-spacing: 9rpx; }
.route-summit-rule { width: 90rpx; margin-top: 12rpx; border-top: 1rpx solid #8c765477; }
.route-node { position: absolute; width: 104rpx; min-height: 126rpx; padding: 0; margin: 0; box-sizing: border-box; overflow: visible; border: none; border-radius: 0; background: transparent; color: var(--ink); text-align: center; line-height: 1.2; z-index: 1; }
.route-node::after { border: none; }
.route-node-orbit { position: relative; width: 86rpx; height: 86rpx; margin: 0 auto; display: flex; align-items: center; justify-content: center; box-sizing: border-box; border: 2rpx solid transparent; border-radius: 50%; background: #eee3cb; background-image: radial-gradient(ellipse, #fbf5e8a0, #c0a57808); }
.route-node-orbit :deep(.map-icon) { pointer-events: none; }
.route-node-label { display: block; font-size: 22rpx; letter-spacing: 2rpx; margin-top: 5rpx; font-weight: 700; }
.route-node-state { display: block; font-size: 18rpx; color: #946c25; letter-spacing: 1rpx; margin-top: 5rpx; }
.node-available .route-node-orbit { border-color: #a58345; background: #e7d7ac; box-shadow: 0 0 0 6rpx #b48b3520; }
.node-available .route-node-label { color: #745622; }
.node-current .route-node-orbit { border: 3rpx solid #4f493a; background: #e3d7bf; }
.node-current .route-node-orbit::after { content: ''; position: absolute; inset: -9rpx -6rpx -6rpx -8rpx; border: 2rpx solid #4f493a; border-radius: 48% 51% 45% 54%; transform: rotate(-13deg); }
.node-current .route-node-state { color: #4f493a; }
.node-visited .route-node-orbit::after { content: ''; position: absolute; inset: -3rpx -7rpx -5rpx -4rpx; border: 3rpx solid #4f493a; border-radius: 46% 53% 47% 54%; transform: rotate(-16deg); }
.node-visited .route-node-orbit::before { content: ''; position: absolute; left: -4rpx; bottom: 6rpx; width: 39rpx; height: 25rpx; border-bottom: 2rpx solid #4f493a99; border-radius: 50%; transform: rotate(28deg); }
.node-future { color: #756d5b; }
.node-future :deep(.map-icon) { opacity: 0.72; }
.node-future .route-node-label { font-weight: 500; }
.node-abandoned { opacity: 0.34; }
.node-abandoned .route-node-label { font-weight: 400; }
.route-node:active .route-node-orbit { transform: scale(0.94); }
.route-node:focus-visible { outline: 3rpx dashed #8b6223; outline-offset: 4rpx; border-radius: 10rpx; }
.route-node-boss { width: 146rpx; min-height: 170rpx; }
.route-node-boss .route-node-orbit { width: 136rpx; height: 136rpx; border: 3rpx double currentColor; box-shadow: inset 0 0 0 7rpx #eee3cb, inset 0 0 0 9rpx #8c765477; border-radius: 47% 50% 48% 51%; }
.route-node-boss .route-node-label { font-size: 26rpx; letter-spacing: 7rpx; }
.route-map-origin { position: absolute; bottom: 29rpx; width: 100%; text-align: center; color: #7b6b51; font-size: 23rpx; letter-spacing: 5rpx; }
.route-origin-rule { width: 128rpx; margin: 0 auto 16rpx; border-top: 1rpx solid #947a5155; }
.route-origin-note { display: block; color: #95836a; font-size: 19rpx; letter-spacing: 1rpx; margin-top: 10rpx; }
.route-map-footer { display: flex; align-items: center; gap: 10rpx; padding: 12rpx 22rpx; font-size: 20rpx; color: #726144; border-top: 1rpx solid #947a5133; background: #d9c49925; flex-shrink: 0; }
.route-footer-dot { width: 8rpx; height: 8rpx; border-radius: 50%; background: #9a712b; }
.route-footer-scroll { margin-left: auto; color: #9a8766; font-size: 18rpx; }

.route-overlay { --paper: #eee3cb; --ink: #39362e; --map-gold: #997027; }
.route-sheet { color: var(--ink); background: var(--paper); background-image: radial-gradient(ellipse at 0 100%, #bb9a5425, transparent 60%), repeating-radial-gradient(ellipse at 70% 18%, #79634307 0, #79634307 1rpx, transparent 2rpx, transparent 7rpx); border: 1rpx solid #a58b63; border-radius: 10rpx; max-width: 650rpx; }
.route-sheet-header { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-bottom: 18rpx; }
.route-sheet-close { color: #675137; border-bottom: 1rpx solid #a18b6b77; flex-shrink: 0; }
.route-preview-title { display: flex; align-items: center; gap: 20rpx; padding: 10rpx 0 20rpx; border-bottom: 1rpx solid #8d765244; }
.route-preview-type { color: #8a682f; display: block; font-size: 22rpx; letter-spacing: 4rpx; }
.route-preview-name { display: block; color: #39362e; font-size: 33rpx; font-weight: 800; margin-top: 5rpx; }
.route-preview-desc { display: block; font-size: 26rpx; line-height: 1.75; margin: 20rpx 0; }
.route-enemy-stats { display: flex; flex-wrap: wrap; gap: 10rpx 22rpx; padding: 13rpx 16rpx; font-size: 23rpx; background: #b79c661a; border-radius: 4rpx; color: #635238; }
.route-preview-note { display: block; font-size: 23rpx; line-height: 1.65; color: #847155; margin: 20rpx 0 8rpx; }
.route-enter-btn, .route-back-btn { width: 100%; margin: 24rpx 0 0; padding: 20rpx; border-radius: 6rpx; font-size: 28rpx; font-weight: 700; line-height: 1.4; }
.route-enter-btn { background: #514533; color: #f3e7cb; box-shadow: inset 0 0 0 3rpx #514533, inset 0 0 0 4rpx #cab07b; }
.route-enter-btn::after, .route-back-btn::after { border: none; }
.route-enter-btn:active { background: #715831; }
.route-back-btn { color: #675137; background: #ccb99033; border: 1rpx solid #a18b6b77; }
.route-legend-title { display: block; font-size: 34rpx; font-weight: 800; font-family: Georgia, 'Songti SC', serif; margin-top: 4rpx; }
.route-legend-types { display: flex; flex-wrap: wrap; padding: 8rpx 0 20rpx; border-bottom: 1rpx solid #8d765244; gap: 22rpx 0; }
.route-legend-type { width: 33.333%; display: flex; flex-direction: column; align-items: center; gap: 7rpx; font-size: 24rpx; }
.route-legend-states { margin-top: 20rpx; display: flex; flex-direction: column; gap: 17rpx; font-size: 23rpx; color: #62553e; }
.route-legend-states > view { display: flex; align-items: center; gap: 16rpx; }
.legend-state { width: 30rpx; height: 30rpx; flex-shrink: 0; border-radius: 50%; }
.legend-available { background: #e0c998; border: 2rpx solid #a58345; }
.legend-current { border: 4rpx double #4f493a; background: #e3d7bf; }
.legend-visited { border: 3rpx solid #4f493a; border-radius: 43% 54% 47% 53%; transform: rotate(-15deg); }
.legend-line { width: 32rpx; height: 0; border-top: 3rpx dashed #867960; flex-shrink: 0; }
.legend-abandoned { opacity: 0.3; }
.route-up-chip { box-shadow: inset 0 3rpx 0 var(--card-color); }
.route-up-chip.card-black { box-shadow: inset 0 3rpx 0 #17191e; }
.route-up-desc { margin: 24rpx 0; }
</style>
