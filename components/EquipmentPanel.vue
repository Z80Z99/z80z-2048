<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../store/gameStore'
import { ALL_EQUIPMENT, getSetData, getEquipStats, isNoSetItem } from '../core/equipment'
import type { Equipment, SortMode } from '../core/equipment'

defineEmits<{ close: [] }>()
const store = useGameStore()
const sortOpen = ref(false)

interface InventoryItem extends Equipment {
  level: number
  compoundId: string
  noset: boolean
}

interface SlotVM {
  key: string
  name: string
  icon: string
  item: InventoryItem | null
  compoundId: string | null
}
const sortModes: { mode: SortMode; label: string }[] = [
  { mode: 'quality', label: '品质优先' },
  { mode: 'level',   label: '等级优先' },
  { mode: 'slot',    label: '部位优先' },
  { mode: 'name',    label: '名称排序' },
  { mode: 'set',     label: '套装优先' },
]

const slotDefs = [
  { key: 'helmet', name: '头盔', icon: '⛑' },
  { key: 'armor',  name: '铠甲', icon: '🛡' },
  { key: 'gloves', name: '手套', icon: '🧤' },
  { key: 'pants',  name: '护腿', icon: '👖' },
  { key: 'boots',  name: '战靴', icon: '👢' },
] as const

const rc: Record<string, { label: string; c: string; bg: string }> = {
  common: { label: '普通', c: '#95a5a6', bg: 'rgba(149,165,166,0.06)' },
  rare:   { label: '稀有', c: '#3498db', bg: 'rgba(52,152,219,0.08)' },
  epic:   { label: '史诗', c: '#e67e22', bg: 'rgba(230,126,34,0.1)' },
}

const inv = computed(() => store.player.inventory.map(compoundId => {
  const baseId = compoundId.split(':')[0]
  const level = parseInt(compoundId.split(':')[1] || '1') || 1
  const eq = ALL_EQUIPMENT.find(e => e.id === baseId)
  if (!eq) return null
  const stats = getEquipStats(compoundId)
  const noset = !eq.set
  return { ...eq, level, stats, compoundId, noset }
}).filter((x): x is InventoryItem => x !== null))

const equipped = computed<SlotVM[]>(() => slotDefs.map(s => {
  const compoundId = store.player.equipment[s.key]
  if (!compoundId) return { ...s, item: null, compoundId: null }
  const baseId = compoundId.split(':')[0]
  const level = parseInt(compoundId.split(':')[1] || '1') || 1
  const eq = ALL_EQUIPMENT.find(e => e.id === baseId)
  if (!eq) return { ...s, item: null, compoundId: null }
  const stats = getEquipStats(compoundId)
  const noset = !eq.set
  return { ...s, item: { ...eq, level, stats, noset }, compoundId }
}))

const equippedIds = computed(() => {
  const ids: string[] = []
  for (const e of equipped.value) if (e.compoundId) ids.push(e.compoundId)
  return ids
})

const totals = computed(() => {
  const t: Record<string, number> = {}
  for (const e of equipped.value) {
    if (!e.item || !e.item.stats) continue
    for (const [k, v] of Object.entries(e.item.stats)) t[k] = (t[k] || 0) + v
  }
  return t
})

const sets = computed(() => {
  const m: Record<string, { cnt: number; name: string; color: string; b: { two: string; three: string; five: string }; level: number }> = {}
  for (const e of equipped.value) {
    if (!e.item || !e.item.set) continue
    const sd = getSetData(e.item.set)
    if (!sd) continue
    const itemLevel = e.item.level || 1
    const key = `${e.item.set}:${itemLevel}`
    if (!m[key]) m[key] = { cnt: 0, name: sd.name || '', color: sd.color || '#888', b: sd.bonuses, level: itemLevel }
    m[key].cnt++
  }
  return m
})

function lab(k: string, _v: number) {
  const n: Record<string, string> = { atk:'攻击', def:'防御', hp:'生命', spd:'速度', gold:'金币', xp:'经验' }
  return n[k] || k
}
function vv(k: string, v: number, noset?: boolean) {
  if (k === 'gold' || k === 'xp') return `+${v}%`
  if (noset && k !== 'spd') return `+${v}%`
  return `+${v}`
}
</script>

<template>
  <view class="eq-root">
    <view class="eq-bg" @click="$emit('close')" />
    <view class="eq-panel">
      <view class="eq-handle"><view class="eq-handle-line" /></view>

      <view class="eq-top-row">
        <view class="eq-col eq-col-stat">
          <text class="eq-sect">装备属性</text>
          <view v-if="!Object.keys(totals).length" class="eq-dim eq-dim-pad">未装备</view>
          <view v-for="([k, v]) in Object.entries(totals)" :key="k" class="eq-stat-row">
            <text class="eq-stat-lbl">{{ lab(k, v) }}</text>
            <text class="eq-stat-val">{{ vv(k, v) }}</text>
          </view>
        </view>

        <view class="eq-col eq-col-slots">
          <view v-for="e in equipped" :key="e.key"
            :class="['eq-slot', e.item ? `eq-slot-${e.item.rarity}` : '']"
            @click="store.UNEQUIP_ITEM(e.key)"
          >
            <template v-if="e.item">
              <text class="eq-slot-name">Lv.{{ e.item.level }} {{ e.item.name }}</text>
            </template>
            <template v-else>
              <text class="eq-slot-icon">{{ e.icon }}</text>
              <text class="eq-slot-placeholder">{{ e.name }}</text>
            </template>
          </view>
        </view>

        <view class="eq-col eq-col-set">
          <text class="eq-sect">套装效果</text>
          <view v-if="!Object.keys(sets).length" class="eq-dim eq-dim-pad">无套装</view>
          <view v-for="([sid, s]) in Object.entries(sets)" :key="sid" class="eq-set">
            <view class="eq-set-top">
              <view class="eq-set-dot" :style="{ background: s.color }" />
              <text class="eq-set-name">{{ s.name }} Lv.{{ s.level }}</text>
              <view class="eq-set-pips">
                <view v-for="i in 5" :key="i" :class="['eq-set-pip', s.cnt >= i ? 'eq-set-pip-on' : '']" :style="s.cnt >= i ? { background: s.color } : {}" />
              </view>
            </view>
            <template v-if="s.cnt >= 2">
              <text :class="['eq-set-eff', s.cnt >= 2 ? 'eq-set-eff-on' : '']">✓ 2件: {{ s.b.two }}</text>
              <text :class="['eq-set-eff', s.cnt >= 3 ? 'eq-set-eff-on' : '']">✓ 3件: {{ s.b.three }}</text>
              <text :class="['eq-set-eff', s.cnt >= 5 ? 'eq-set-eff-on' : '']">✓ 5件: {{ s.b.five }}</text>
            </template>
          </view>
        </view>
      </view>

      <view class="eq-divider" />

      <view class="eq-bottom">
        <view class="eq-bottom-hd">
          <text class="eq-sect eq-bottom-title">背包 · {{ inv.length }} 件</text>
          <view class="eq-sort-wrap">
            <view class="eq-sort-btn" @click="sortOpen = !sortOpen">整理 ▾</view>
            <view v-if="sortOpen" class="eq-sort-drop">
              <view v-for="m in sortModes" :key="m.mode" class="eq-sort-opt" @click="store.SORT_INVENTORY(m.mode); sortOpen = false">{{ m.label }}</view>
            </view>
          </view>
        </view>
        <scroll-view scroll-y class="eq-inv-scroll" :show-scrollbar="false">
          <view v-if="!inv.length" class="eq-dim eq-dim-pad">暂无装备</view>
          <view class="eq-inv-grid">
            <view v-for="(item, i) in inv" :key="item.compoundId"
              :class="['eq-inv-card', `eq-inv-${item.rarity}`, equippedIds.includes(item.compoundId) ? 'eq-inv-equipped' : '']"
              :style="{ animationDelay: `${i * 0.03}s` }"
              @click="store.EQUIP_ITEM(item.compoundId)"
            >
              <view class="eq-inv-top">
                <text class="eq-inv-icon">{{ slotDefs.find(s => s.key === item.slot)?.icon || '◆' }}</text>
                <view v-if="equippedIds.includes(item.compoundId)" class="eq-inv-check"><text>✓</text></view>
              </view>
              <text class="eq-inv-name">Lv.{{ item.level }} {{ item.name }}</text>
              <text class="eq-inv-desc">{{ Object.entries(item.stats || {}).map(([k, v]) => `${lab(k, v)} ${vv(k, v, item.noset)}`).join(' ') }}</text>
            </view>
          </view>
          <view style="height: 10rpx;" />
        </scroll-view>
      </view>

      <text class="eq-footer">点击已装备卸下 · 点击背包装备</text>
    </view>
  </view>
</template>

<style lang="scss">
.eq-root { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 85; display: flex; align-items: flex-end; }
.eq-bg { position: absolute; inset: 0; background: rgba(2,2,12,0.6); animation: eq-bg-in 0.25s; }
@keyframes eq-bg-in { from { opacity: 0; } to { opacity: 1; } }

.eq-panel {
  position: relative; width: 100%; height: 80vh; max-height: 80vh;
  background: linear-gradient(180deg, #12122a 0%, #0a0a18 40%);
  border-radius: 28rpx 28rpx 0 0; display: flex; flex-direction: column;
  box-shadow: 0 -4rpx 32rpx rgba(0,0,0,0.5);
  animation: eq-slide 0.35s cubic-bezier(0.22,0.99,0.38,1.02);
}
@keyframes eq-slide { from { transform: translateY(50%); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }

.eq-handle { display: flex; justify-content: center; padding: 12rpx 0 4rpx; }
.eq-handle-line { width: 50rpx; height: 4rpx; background: rgba(255,255,255,0.08); border-radius: 2rpx; }

.eq-top-row { display: flex; gap: 12rpx; padding: 10rpx 20rpx 0; align-items: stretch; }
.eq-col { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.eq-col-slots { gap: 8rpx; }
.eq-col-stat { overflow-y: auto; }
.eq-col-set { overflow-y: auto; }

.eq-sect { font-size: 20rpx; font-weight: 700; color: #888; letter-spacing: 2rpx; display: block; margin-bottom: 8rpx; }
.eq-dim { font-size: 18rpx; color: #444; } .eq-dim-pad { padding: 20rpx 0; text-align: center; }

.eq-stat-row { display: flex; justify-content: space-between; padding: 12rpx 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
.eq-stat-lbl { font-size: 22rpx; color: #888; }
.eq-stat-val { font-size: 22rpx; font-weight: 700; color: #f1c40f; }

.eq-slot { display: flex; align-items: center; justify-content: space-between; padding: 14rpx 16rpx; border-radius: 12rpx; border: 2px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); transition: all 0.15s; height: 64rpx; box-sizing: border-box; }
.eq-slot:active { transform: scale(0.97); }
.eq-slot-common { border-color: rgba(149,165,166,0.4); background: rgba(149,165,166,0.05); }
.eq-slot-rare { border-color: rgba(52,152,219,0.45); background: rgba(52,152,219,0.07); box-shadow: 0 0 10rpx rgba(52,152,219,0.15); }
.eq-slot-epic { border-color: rgba(230,126,34,0.5); background: rgba(230,126,34,0.09); box-shadow: 0 0 18rpx rgba(230,126,34,0.25); animation: eq-epic 2s ease-in-out infinite; }
@keyframes eq-epic { 0%,100% { box-shadow: 0 0 12rpx rgba(230,126,34,0.2); } 50% { box-shadow: 0 0 24rpx rgba(230,126,34,0.45); } }
.eq-slot-name { font-size: 22rpx; font-weight: 800; color: #fff; }
.eq-slot-badge { padding: 2rpx 10rpx; border-radius: 5rpx; border: 1px solid; }
.eq-slot-badge-txt { font-size: 16rpx; font-weight: 600; }
.eq-slot-icon { font-size: 28rpx; opacity: 0.25; }
.eq-slot-placeholder { font-size: 22rpx; color: #444; }

.eq-set { margin-bottom: 10rpx; padding: 10rpx 12rpx; border-radius: 10rpx; background: rgba(255,255,255,0.02); }
.eq-set-top { display: flex; align-items: center; gap: 6rpx; margin-bottom: 6rpx; }
.eq-set-dot { width: 10rpx; height: 10rpx; border-radius: 5rpx; flex-shrink: 0; }
.eq-set-name { font-size: 19rpx; font-weight: 700; color: #ccc; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.eq-set-pips { display: flex; gap: 4rpx; }
.eq-set-pip { width: 12rpx; height: 12rpx; border-radius: 6rpx; background: rgba(255,255,255,0.06); transition: all 0.3s; }
.eq-set-pip-on { box-shadow: 0 0 4rpx rgba(255,255,255,0.15); }
.eq-set-eff { font-size: 16rpx; color: #444; display: block; margin: 3rpx 0; transition: color 0.3s; }
.eq-set-eff-on { color: #2ecc71; }

.eq-divider { height: 1px; background: rgba(255,255,255,0.04); margin: 14rpx 20rpx; }

.eq-bottom { padding: 0 20rpx; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.eq-bottom-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8rpx; }
.eq-bottom-title { margin-bottom: 0 !important; }
.eq-sort-wrap { position: relative; }
.eq-sort-btn { font-size: 18rpx; color: #3498db; padding: 8rpx 16rpx; border-radius: 14rpx; border: 1px solid rgba(52,152,219,0.3); background: rgba(52,152,219,0.06); font-weight: 600; }
.eq-sort-btn:active { background: rgba(52,152,219,0.15); transform: scale(0.95); }
.eq-sort-drop { position: absolute; top: 100%; right: 0; margin-top: 6rpx; background: #1a1a30; border-radius: 10rpx; border: 1px solid rgba(52,152,219,0.2); box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.5); z-index: 10; min-width: 140rpx; padding: 6rpx 0; }
.eq-sort-opt { font-size: 20rpx; color: #aaa; padding: 12rpx 22rpx; white-space: nowrap; transition: all 0.12s; }
.eq-sort-opt:active { background: rgba(52,152,219,0.1); color: #3498db; }
.eq-inv-scroll { flex: 1; height: 0; }

.eq-inv-grid { display: flex; flex-wrap: wrap; gap: 8rpx; align-content: flex-start; }
.eq-inv-card { width: calc(33.33% - 6rpx); padding: 10rpx; border-radius: 10rpx; border: 2px solid; box-sizing: border-box; transition: all 0.15s; animation: eq-inv-pop 0.3s ease-out both; }
@keyframes eq-inv-pop { from { opacity: 0; transform: translateY(16rpx); } to { opacity: 1; transform: translateY(0); } }
.eq-inv-card:active { transform: scale(0.95); }
.eq-inv-common { border-color: rgba(149,165,166,0.25); background: rgba(149,165,166,0.03); }
.eq-inv-rare { border-color: rgba(52,152,219,0.3); background: rgba(52,152,219,0.04); }
.eq-inv-epic { border-color: rgba(230,126,34,0.35); background: rgba(230,126,34,0.05); }
.eq-inv-equipped { opacity: 0.5; }
.eq-inv-equipped .eq-inv-name { color: #2ecc71; }
.eq-inv-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4rpx; }
.eq-inv-icon { font-size: 28rpx; }
.eq-inv-check { width: 28rpx; height: 28rpx; display: flex; align-items: center; justify-content: center; background: rgba(46,204,113,0.2); border-radius: 14rpx; font-size: 16rpx; color: #2ecc71; font-weight: bold; }
.eq-inv-name { font-size: 18rpx; font-weight: 800; color: #ddd; display: block; margin-bottom: 3rpx; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.eq-inv-desc { font-size: 14rpx; color: #888; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; line-height: 20rpx; }

.eq-footer { text-align: center; font-size: 17rpx; color: #444; padding: 10rpx 0 22rpx; flex-shrink: 0; }
</style>
