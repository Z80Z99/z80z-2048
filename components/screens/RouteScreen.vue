<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useGameStore } from '../../store/gameStore'
import { computeEquipBonuses } from '../../core/equipment'
import type { RouteNode } from '../../types'

const store = useGameStore()

const nodeConfig: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  battle: { icon: '⚔', label: '战斗', color: '#e74c3c', bg: '#3d1a1a' },
  elite: { icon: '☠', label: '精英', color: '#e67e22', bg: '#3d2a10' },
  event: { icon: '?', label: '事件', color: '#9b59b6', bg: '#2a103d' },
  shop: { icon: '⬟', label: '商店', color: '#f1c40f', bg: '#3d3510' },
  rest: { icon: '✚', label: '休息', color: '#2ecc71', bg: '#1a3d28' },
  boss: { icon: '◆', label: 'BOSS', color: '#e74c3c', bg: '#3d0a0a' },
}

const showPanel = ref(true)
const upDetail = ref<string | null>(null)
const showUpList = ref(false)

const eq = computed(() => computeEquipBonuses(store.player.equipment))
const upCount = computed(() => store.upgrades.length)

function groupByLayer(route: RouteNode[]): RouteNode[][] {
  const raw: RouteNode[][] = []
  for (const n of route) { const i = n.layer - 1; if (!raw[i]) raw[i] = []; raw[i].push(n) }
  return raw.filter(Boolean)
}
const layers = computed(() => groupByLayer(store.route).reverse())

const activeNode = computed(() => store.route.find(n => n.accessible && !n.completed) ?? null)

const mapTarget = computed(() => {
  if (!store.screen || store.screen !== 'route') return 0
  const al = activeNode.value?.layer ?? 1
  const idx = layers.value.findIndex(ln => ln[0]?.layer === al)
  return idx >= 0 ? idx * 200 : 0
})
const mapOffset = ref(mapTarget.value)
const touching = ref(false)
let touchStartY = 0
let offsetStart = 0

watch(mapTarget, (t) => {
  if (!touching.value) mapOffset.value = t
})

function onMapTouchStart(e: any) {
  touching.value = true
  touchStartY = e.touches[0].clientY
  offsetStart = mapOffset.value
}
function onMapTouchMove(e: any) {
  if (!touching.value) return
  const dy = touchStartY - e.touches[0].clientY
  const maxOffset = Math.max(0, (layers.value.length - 1) * 200)
  mapOffset.value = Math.max(0, Math.min(maxOffset, offsetStart + dy))
}
function onMapTouchEnd() { touching.value = false }
</script>

<template>
  <view class="route-page">
    <view v-if="showPanel" class="route-panel-fixed">
      <view class="rp-row1">
        <view class="rp-hp-card">
          <view class="rp-hp-top">
            <text class="rp-label">❤ 生命值</text>
            <text class="rp-hp-num">{{ store.player.hp }}<text class="rp-hp-max">/{{ store.player.maxHp }}</text></text>
          </view>
          <view class="rp-hp-bar">
            <view class="rp-hp-fill" :style="{ width: `${Math.max(0, (store.player.hp / store.player.maxHp) * 100)}%` }" />
          </view>
        </view>
        <view class="rp-info-cards">
          <view class="rp-info-card rp-info-gold">
            <text class="rp-info-label">金币</text>
            <text class="rp-info-val">{{ store.player.gold }}</text>
          </view>
          <view class="rp-info-card rp-info-lv">
            <text class="rp-info-label">等级</text>
            <text class="rp-info-val">Lv.{{ store.player.level }}</text>
            <view class="rp-info-xp-bar">
              <view class="rp-info-xp-fill" :style="{ width: `${Math.min(100, (store.player.xp / store.player.xpToNext) * 100)}%` }" />
            </view>
          </view>
        </view>
      </view>
      <view class="rp-row2">
        <view class="rp-stat-item">
          <text class="rp-stat-icon">⚔</text>
          <view class="rp-stat-body">
            <text class="rp-stat-label">攻击倍率</text>
            <view class="rp-stat-row">
              <text class="rp-stat-val">×{{ store.player.attackMultiplier.toFixed(2) }}</text>
              <text v-if="store.player.flatAttack > 0" class="rp-stat-bonus">+{{ store.player.flatAttack }}</text>
            </view>
          </view>
        </view>
        <view class="rp-stat-item">
          <text class="rp-stat-icon">🛡</text>
          <view class="rp-stat-body">
            <text class="rp-stat-label">防御倍率</text>
            <view class="rp-stat-row">
              <text class="rp-stat-val">×{{ store.player.defenseMultiplier.toFixed(2) }}</text>
              <text v-if="store.player.flatDefense > 0" class="rp-stat-bonus">+{{ store.player.flatDefense }}</text>
            </view>
          </view>
        </view>
        <view class="rp-stat-item">
          <text class="rp-stat-icon">⚡</text>
          <view class="rp-stat-body">
            <text class="rp-stat-label">速度</text>
            <view class="rp-stat-row">
              <text class="rp-stat-val">{{ store.player.baseSpeed }}</text>
              <text v-if="eq.stats.spd > 0" class="rp-stat-bonus">+{{ eq.stats.spd }}</text>
            </view>
          </view>
        </view>
        <view class="rp-stat-item">
          <text class="rp-stat-icon">👟</text>
          <view class="rp-stat-body">
            <text class="rp-stat-label">步数</text>
            <text class="rp-stat-val">{{ store.player.baseMaxTurns + store.player.bonusTurns }}</text>
          </view>
        </view>
      </view>
      <view class="rp-row3">
        <view v-if="store.player.enemyAtkDown > 0" class="rp-stat-item rp-stat-nerf">
          <text class="rp-stat-icon">↓</text>
          <view class="rp-stat-body">
            <text class="rp-stat-label">削弱敌人攻击</text>
            <text class="rp-stat-val">-{{ store.player.enemyAtkDown }}</text>
          </view>
        </view>
        <view class="rp-stat-item" @click.stop.prevent="showUpList = !showUpList">
          <text class="rp-stat-icon">⬆</text>
          <view class="rp-stat-body">
            <text class="rp-stat-label">已获强化</text>
            <text class="rp-stat-val">{{ upCount }} 个 {{ showUpList ? '▲' : '▼' }}</text>
          </view>
        </view>
      </view>
      <view v-if="showUpList && upCount > 0" class="rp-up-list">
        <view v-for="u in store.upgrades" :key="u.def.id" class="rp-up-item" @click="upDetail = u.def.id">
          <text class="rp-up-name">{{ u.def.name }}</text>
          <text class="rp-up-count">×{{ u.count }}</text>
        </view>
      </view>
      <view class="route-toggle" @click="showPanel = false">
        <text class="route-toggle-text">▲ 隐藏面板</text>
      </view>
    </view>

    <view v-if="!showPanel" class="route-toggle-fab" @click="showPanel = true">
      <text class="route-toggle-text">▼ 显示面板</text>
    </view>

    <view class="route-map-viewport" :style="{ top: showPanel ? '420rpx' : '0' }"
      @touchstart="onMapTouchStart" @touchmove="onMapTouchMove" @touchend="onMapTouchEnd">
      <view class="route-stage-float">阶段 S{{ store.stage }}</view>
      <view class="route-map-inner" :class="{ touching: touching }" :style="{ transform: `translateY(-${mapOffset}rpx)` }">
        <view v-for="layerNodes in layers" :key="layerNodes[0]?.layer ?? 0"
          :class="['route-layer-section', { 'layer-current': activeNode ? activeNode.layer === layerNodes[0]?.layer : false }]">
          <view class="route-floor-wrap">
            <view class="route-floor-line" />
            <text class="route-floor-text">{{ layerNodes[0]?.type === 'boss' ? 'BOSS' : `第 ${layerNodes[0]?.layer} 层` }}</text>
            <view class="route-floor-line" />
          </view>
          <view class="route-nodes-row">
            <view v-for="node in layerNodes" :key="node.id"
              :class="['route-node-card', node.completed?'node-done':'', node.accessible&&!node.completed?'node-active':'', !node.accessible&&!node.completed?'node-locked':'']"
              :style="node.accessible&&!node.completed?{borderColor:nodeConfig[node.type]?.color,boxShadow:`0 0 20rpx ${nodeConfig[node.type]?.color}33`}:{}"
              @click="node.accessible&&!node.completed?store.SELECT_NODE(node.id):undefined">
              <view class="rn-icon-circle"
                :style="{background:node.completed?'#333':(!node.accessible&&!node.completed)?'#1a1a2e':nodeConfig[node.type]?.bg,borderColor:node.completed?'#555':(!node.accessible&&!node.completed)?'#333':nodeConfig[node.type]?.color}">
                <text class="rn-emoji">{{ nodeConfig[node.type]?.icon }}</text>
              </view>
              <text class="rn-name">{{ nodeConfig[node.type]?.label }}</text>
              <text v-if="node.completed" class="rn-check">✓</text>
            </view>
          </view>
        </view>
        <view style="height: 200px;" />
      </view>
    </view>

    <view v-if="upDetail" class="rp-up-detail" @click="upDetail = null">
      <view class="rp-up-detail-inner" @click.stop>
        <text class="rp-up-detail-name">{{ store.upgrades.find(x => x.def.id === upDetail)?.def.name }} ×{{ store.upgrades.find(x => x.def.id === upDetail)?.count }}</text>
        <text class="rp-up-detail-desc">{{ store.upgrades.find(x => x.def.id === upDetail)?.def.description }}</text>
        <text class="rp-up-detail-max">最多叠加 {{ store.upgrades.find(x => x.def.id === upDetail)?.def.maxStacks }} 次</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss">
.route-page { min-height: 100vh; background: linear-gradient(180deg, #0a0a1a 0%, #12122a 50%, #0a0a1a 100%); }
.route-panel-fixed { position: fixed; top: 0; left: 0; right: 0; z-index: 30; background: #0c0c20; border-bottom: 2px solid rgba(255,255,255,0.06); padding: 20rpx 16rpx 20rpx; }
.route-toggle-fab { position: fixed; top: 12rpx; left: 50%; transform: translateX(-50%); z-index: 31; background: rgba(20,20,40,0.9); border: 1px solid rgba(255,255,255,0.12); border-radius: 20rpx; padding: 8rpx 28rpx; }
.route-toggle-text { font-size: 22rpx; color: #888; }

.rp-row1 { display:flex; gap:12rpx; margin-bottom:12rpx; }
.rp-hp-card { flex:1.4; }
.rp-hp-top { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6rpx; }
.rp-label { font-size:17rpx; color:#888; font-weight:500; letter-spacing:1rpx; }
.rp-hp-num { font-size:30rpx; font-weight:900; color:#fff; }
.rp-hp-max { font-size:18rpx; color:#888; font-weight:400; }
.rp-hp-bar { height:16rpx; background:rgba(255,255,255,0.05); border-radius:8rpx; overflow:hidden; box-shadow:inset 0 2rpx 4rpx rgba(0,0,0,0.3); }
.rp-hp-fill { height:100%; background:linear-gradient(90deg, #27ae60, #2ecc71); border-radius:8rpx; transition:width 0.5s; box-shadow:0 0 8rpx rgba(46,204,113,0.3); animation: hp-glow 2s ease-in-out infinite; }
.rp-info-cards { display:flex; gap:8rpx; flex:2; }
.rp-info-card { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:10rpx 4rpx; border-radius:12rpx; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); text-align:center; animation: card-pop 0.3s ease-out both; }
.rp-info-card:nth-child(1) { animation-delay:0.05s; }
.rp-info-card:nth-child(2) { animation-delay:0.1s; }
.rp-info-card:nth-child(3) { animation-delay:0.15s; }
.rp-info-label { font-size:17rpx; color:#888; letter-spacing:1rpx; }
.rp-info-val { font-size:24rpx; font-weight:800; }
.rp-info-stage { border-color:rgba(52,152,219,0.2); background:rgba(52,152,219,0.06); }
.rp-info-stage .rp-info-val { color:#3498db; }
.rp-info-gold { border-color:rgba(241,196,15,0.2); background:rgba(241,196,15,0.06); }
.rp-info-gold .rp-info-val { color:#f1c40f; }
.rp-info-lv { border-color:rgba(155,89,182,0.2); background:rgba(155,89,182,0.06); }
.rp-info-lv .rp-info-val { color:#9b59b6; }
.rp-info-xp-bar { width:80rpx; height:5rpx; background:rgba(255,255,255,0.06); border-radius:3rpx; overflow:hidden; margin-top:6rpx; }
.rp-info-xp-fill { height:100%; background:#9b59b6; border-radius:3rpx; box-shadow:0 0 4rpx rgba(155,89,182,0.3); }
.rp-row2,.rp-row3 { display:flex; gap:10rpx; margin-bottom:8rpx; }
.rp-stat-item { flex:1; display:flex; align-items:center; gap:10rpx; padding:10rpx 12rpx; border-radius:12rpx; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.04); animation: card-pop 0.25s ease-out both; }
.rp-stat-item:nth-child(1) { animation-delay:0.18s; }
.rp-stat-item:nth-child(2) { animation-delay:0.22s; }
.rp-stat-item:nth-child(3) { animation-delay:0.26s; }
.rp-stat-item:nth-child(4) { animation-delay:0.3s; }
.rp-stat-icon { font-size:26rpx; width:32rpx; text-align:center; }
.rp-stat-body { display:flex; flex-direction:column; }
.rp-stat-label { font-size:17rpx; color:#888; letter-spacing:1rpx; }
.rp-stat-val { font-size:24rpx; font-weight:800; color:#fff; }
.rp-stat-row { display:flex; align-items:baseline; gap:6rpx; }
.rp-stat-bonus { font-size:19rpx; font-weight:700; color:#f1c40f; }
.rp-stat-nerf { border-color:rgba(46,204,113,0.25); background:rgba(46,204,113,0.08); }
.rp-stat-nerf .rp-stat-val { color:#2ecc71; }
.rp-stat-nerf .rp-stat-label { color:#2ecc71; opacity:0.8; }
.rp-up-list { display:flex; flex-wrap:wrap; gap:6rpx; margin-top:8rpx; padding-top:8rpx; border-top:1px solid rgba(255,255,255,0.04); }
.rp-up-item { display:flex; align-items:center; gap:6rpx; padding:8rpx 14rpx; border-radius:8rpx; background:rgba(155,89,182,0.1); border:1px solid rgba(155,89,182,0.15); }
.rp-up-name { font-size:22rpx; color:#dda0dd; }
.rp-up-count { font-size:20rpx; color:#9b59b6; font-weight:bold; }
.rp-up-detail { position:fixed; top:0;left:0;right:0;bottom:0; background:rgba(0,0,0,0.5); z-index:40; display:flex; align-items:center; justify-content:center; }
.rp-up-detail-inner { background:#1a1a2e; border-radius:14rpx; padding:24rpx; width:280rpx; text-align:center; }
.rp-up-detail-name { font-size:28rpx; font-weight:800; color:#dda0dd; display:block; }
.rp-up-detail-desc { font-size:24rpx; color:#ccc; display:block; margin-top:12rpx; line-height:36rpx; }
.rp-up-detail-max { font-size:18rpx; color:#888; display:block; margin-top:16rpx; }
.route-toggle { text-align: center; padding: 6rpx 0 0; margin-top: 4rpx; border-top: 1px solid rgba(255,255,255,0.04); }

.route-map-viewport { position: fixed; left: 0; right: 0; bottom: 0; overflow: hidden; }
.route-stage-float { position: fixed; top: 430rpx; right: 16rpx; z-index: 35; background: rgba(52,152,219,0.15); border: 1px solid rgba(52,152,219,0.3); border-radius: 10rpx; padding: 4rpx 16rpx; font-size: 24rpx; font-weight: 800; color: #3498db; pointer-events: none; }
.route-map-inner { transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
.route-map-inner.touching { transition: none; }
.route-layer-section { margin-bottom: 8rpx; animation: layer-rise 0.4s ease-out both; }
.layer-current .route-floor-text { color: #f1c40f; font-weight: bold; text-shadow: 0 0 12rpx rgba(241,196,15,0.4); }
.route-floor-wrap { display: flex; align-items: center; justify-content: center; gap: 16rpx; padding: 24rpx 0 16rpx; }
.route-floor-line { width: 60rpx; height: 1px; background: rgba(255,255,255,0.08); transition: all 0.5s; }
.route-floor-text { font-size: 22rpx; color: #555; letter-spacing: 6rpx; transition: all 0.3s; }
.route-nodes-row { display: flex; justify-content: center; gap: 20rpx; flex-wrap: wrap; }
.route-node-card { display: flex; flex-direction: column; align-items: center; width: 150rpx; padding: 20rpx 12rpx 16rpx; border-radius: 16rpx; border: 2px solid transparent; background: rgba(255,255,255,0.03); position: relative; box-sizing: border-box; transition: all 0.2s; }
.node-active { background: rgba(255,255,255,0.06); animation: node-active-glow 2s ease-in-out infinite; }
.node-active:active { transform: scale(0.95); }
.node-done { opacity: 0.4; border-color: #333; }
.node-locked { opacity: 0.2; }
.rn-icon-circle { width: 72rpx; height: 72rpx; border-radius: 36rpx; border: 3px solid; display: flex; align-items: center; justify-content: center; margin-bottom: 10rpx; }
.rn-emoji { font-size: 32rpx; }
.rn-name { font-size: 22rpx; font-weight: bold; color: #ccc; margin-bottom: 4rpx; }
.rn-check { position: absolute; top: 8rpx; right: 12rpx; font-size: 20rpx; color: #2ecc71; font-weight: bold; }
</style>
