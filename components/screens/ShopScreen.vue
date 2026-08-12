<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '../../store/gameStore'
import { UPGRADE_POOL, rarityText, upgradeCost } from '../../core/upgrade'
import { ALL_EQUIPMENT, equipCost, getEquipStats } from '../../core/equipment'

const store = useGameStore()

const showRemove2 = ref(false)
</script>

<template>
  <view class="sv2">
    <view class="sv2-hd">
      <text class="sv2-title">商 店</text>
      <view class="sv2-gold">
        <text class="sv2-gold-dot">●</text>
        <text class="sv2-gold-num">{{ store.player.gold }}</text>
      </view>
    </view>
    <scroll-view class="sv2-body" scroll-y>
      <view class="sv2-sec">
        <view class="sv2-sec-hd">
          <text class="sv2-sec-title">— 强化卡 —</text>
          <view class="sv2-ref" @click="store.REFRESH_SHOP()">
            <text class="sv2-ref-txt">↻ {{ store.shopRefreshCost }}G</text>
          </view>
        </view>
        <view class="sv2-row">
          <view v-for="(uid, i) in store.shopUpgrades" :key="i"
            :class="['sv2-card', uid ? 'sv2-card-rarity-' + (UPGRADE_POOL.find(u => u.id === uid)?.rarity ?? 'common') : 'sv2-card-sold']"
            @click="store.BUY_SHOP_UPGRADE(i)">
            <template v-if="uid">
              <text class="sv2-card-tag">{{ rarityText(UPGRADE_POOL.find(u => u.id === uid)?.rarity ?? 'common') }}</text>
              <text class="sv2-card-name">{{ UPGRADE_POOL.find(u => u.id === uid)?.name }}</text>
              <view class="sv2-card-desc">
                <text class="sv2-card-desc-txt">{{ UPGRADE_POOL.find(u => u.id === uid)?.description }}</text>
              </view>
              <text :class="['sv2-card-price', store.player.gold >= upgradeCost(UPGRADE_POOL.find(u => u.id === uid)!) ? '' : 'sv2-nope']">{{ upgradeCost(UPGRADE_POOL.find(u => u.id === uid)!) }}G</text>
            </template>
            <text v-else class="sv2-sold-txt">— 已售 —</text>
          </view>
        </view>
      </view>

      <view class="sv2-sec">
        <text class="sv2-sec-title">— 装备 —</text>
        <view class="sv2-row">
          <template v-for="(eid, i) in store.shopEquipment" :key="i">
            <view v-if="!eid" class="sv2-card sv2-card-sold">
              <text class="sv2-sold-txt">— 已售 —</text>
            </view>
            <view v-else :class="['sv2-card', 'sv2-card-rarity-' + (ALL_EQUIPMENT.find(e => e.id === eid)?.rarity ?? 'common')]" @click="store.BUY_SHOP_EQUIP(i)">
              <text class="sv2-card-tag">{{ rarityText(ALL_EQUIPMENT.find(e => e.id === eid)?.rarity ?? 'common') }}</text>
              <text class="sv2-card-name">{{ ALL_EQUIPMENT.find(e => e.id === eid)?.name }}</text>
              <view class="sv2-card-desc sv2-card-stats">
                <text class="sv2-card-stats-txt">{{ Object.entries(getEquipStats(eid)).map(([k, v]) => k === 'atk' ? `攻击+${v}%` : k === 'def' ? `防御+${v}%` : k === 'spd' ? `速度+${v}` : k === 'hp' ? `生命+${v}%` : k === 'gold' ? `金币+${v}%` : '').filter(Boolean).join(' ') }}</text>
              </view>
              <text :class="['sv2-card-price', store.player.gold >= equipCost(ALL_EQUIPMENT.find(e => e.id === eid)!) ? '' : 'sv2-nope']">{{ equipCost(ALL_EQUIPMENT.find(e => e.id === eid)!) }}G</text>
            </view>
          </template>
        </view>
      </view>

      <view class="sv2-sec">
        <view class="sv2-split">
          <view class="sv2-split-half">
            <text class="sv2-sec-title">— 回复 —</text>
            <template v-for="(hid, i) in store.shopHeals" :key="i">
              <view v-if="!hid" class="sv2-card sv2-card-sold" style="height:150rpx">
                <text class="sv2-sold-txt">— 已售 —</text>
              </view>
              <view v-else class="sv2-card sv2-card-heal" style="height:150rpx" @click="store.BUY_SHOP_HEAL(i)">
                <text class="sv2-card-tag" style="color:#2ecc71">回复</text>
                <text class="sv2-card-name">{{ UPGRADE_POOL.find(u => u.id === hid)?.name }}</text>
                <view class="sv2-card-desc">
                  <text class="sv2-card-desc-txt">{{ UPGRADE_POOL.find(u => u.id === hid)?.description }}</text>
                </view>
                <text class="sv2-card-price">{{ Math.floor(((UPGRADE_POOL.find(u => u.id === hid)?.effect.value ?? 0)) * 1.5) }}G</text>
              </view>
            </template>
          </view>
          <view class="sv2-split-half">
            <text class="sv2-sec-title">— 移除 —</text>
            <view v-if="store.shopRemoveUsed" class="sv2-card sv2-card-sold" style="height:140rpx">
              <text class="sv2-sold-txt">— 已用 —</text>
            </view>
            <view v-else class="sv2-card sv2-card-heal" style="height:140rpx;border-color:#e74c3c;background:rgba(231,76,60,0.06)" @click="showRemove2 = true">
              <text class="sv2-card-tag" style="color:#e74c3c">移除</text>
              <text class="sv2-card-name">移除强化</text>
              <text class="sv2-card-price">{{ store.shopRemoveCost }}G</text>
            </view>
          </view>
        </view>
      </view>
      <view style="height: 32px;" />
    </scroll-view>

    <view class="sv2-leave" @click="store.GO_TO_ROUTE()">
      <text class="sv2-leave-txt">离开商店</text>
    </view>

    <view v-if="showRemove2" class="sv2-rm-overlay" @click="showRemove2 = false">
      <view class="sv2-rm-panel" @click.stop>
        <view class="sv2-rm-hd">
          <text class="sv2-rm-title">移除强化</text>
          <view class="sv2-rm-close" @click="showRemove2 = false"><text>×</text></view>
        </view>
        <scroll-view class="sv2-rm-list" scroll-y>
          <text v-if="store.upgrades.length === 0" class="sv2-none">无强化</text>
          <view v-for="u in store.upgrades" :key="u.def.id" class="sv2-rm-item" @click="store.SHOP_REMOVE_UPGRADE(u.def.id); showRemove2 = false">
            <text class="sv2-rm-item-name">{{ u.def.name }} ×{{ u.count }}</text>
            <text :class="['sv2-rm-item-cost', store.player.gold < store.shopRemoveCost ? 'sv2-nope' : '']">{{ store.player.gold >= store.shopRemoveCost ? `${store.shopRemoveCost}G` : '金币不足' }}</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<style lang="scss">
.sv2 { background: #0d0d1a; min-height:100vh; padding:24rpx 20rpx 220rpx; display:flex; flex-direction:column; }
.sv2-hd { display:flex; justify-content:space-between; align-items:center; margin-bottom:24rpx; }
.sv2-title { font-size:40rpx; font-weight:900; color:#f1c40f; }
.sv2-gold { display:flex; align-items:center; gap:6rpx; background:rgba(241,196,15,0.1); border:1px solid rgba(241,196,15,0.2); border-radius:24rpx; padding:10rpx 24rpx; }
.sv2-gold-dot { font-size:20rpx; color:#f1c40f; } .sv2-gold-num { font-size:30rpx; font-weight:900; color:#f1c40f; }
.sv2-body { flex:1; } .sv2-sec { margin-bottom:28rpx; }
.sv2-sec-hd { display:flex; justify-content:space-between; align-items:center; margin-bottom:10rpx; }
.sv2-sec-title { font-size:24rpx; font-weight:700; color:#888; }
.sv2-ref { padding:8rpx 18rpx; background:rgba(52,152,219,0.08); border:1px solid rgba(52,152,219,0.15); border-radius:10rpx; }
.sv2-ref-txt { font-size:20rpx; color:#3498db; font-weight:600; }
.sv2-row { display:flex; gap:12rpx; } .sv2-split { display:flex; gap:16rpx; } .sv2-split-half { flex:1; }
.sv2-card { flex:1; padding:14rpx; border-radius:12rpx; border:2px solid; display:flex; flex-direction:column; gap:6rpx; min-height:210rpx; box-sizing:border-box; overflow:hidden; transition: all 0.2s; animation: card-pop 0.35s ease-out both; }
.sv2-card:active { transform: scale(0.96); filter: brightness(1.2); }
.sv2-card:nth-child(1) { animation-delay: 0.05s; }
.sv2-card:nth-child(2) { animation-delay: 0.12s; }
.sv2-card:nth-child(3) { animation-delay: 0.19s; }
.sv2-card-rarity-common { border-color:#7f8c8d; background:rgba(127,140,141,0.08); }
.sv2-card-rarity-rare { border-color:#3498db; background:rgba(52,152,219,0.1); }
.sv2-card-rarity-epic { border-color:#e67e22; background:rgba(230,126,34,0.12); }
.sv2-card-sold { border-color:rgba(255,255,255,0.04); border-style:dashed; background:rgba(255,255,255,0.01); justify-content:center; align-items:center; }
.sv2-card-heal { border-color:#2ecc71; background:rgba(46,204,113,0.08); }
.sv2-card-tag { font-size:20rpx; color:#888; flex-shrink:0; }
.sv2-card-name { font-size:28rpx; font-weight:800; color:#fff; flex-shrink:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sv2-card-desc { overflow:hidden; max-height:56rpx; } .sv2-card-desc-txt { font-size:22rpx; color:#888; line-height:28rpx; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; white-space:normal; word-break:break-all; }
.sv2-card-stats { overflow:hidden; max-height:56rpx; } .sv2-card-stats-txt { font-size:22rpx; color:#888; line-height:28rpx; display:block; white-space:normal; word-break:break-all; }
.sv2-card-price { font-size:26rpx; font-weight:900; color:#f1c40f; align-self:flex-end; flex-shrink:0; margin-top:auto; } .sv2-nope { color:#e74c3c; }
.sv2-sold-txt { font-size:20rpx; color:#888; }
.sv2-leave { text-align:center; padding:18rpx; background:rgba(255,255,255,0.03); border-radius:12rpx; position:fixed; bottom:110rpx; left:20rpx; right:20rpx; }
.sv2-leave-txt { font-size:26rpx; color:#888; }
.sv2-rm-overlay { position:fixed; top:0;left:0;right:0;bottom:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:200; }
.sv2-rm-panel { background:#1a1a2e; border-radius:16rpx; padding:24rpx; width:300px; max-height:60vh; }
.sv2-rm-hd { display:flex; justify-content:space-between; align-items:center; margin-bottom:16rpx; }
.sv2-rm-title { font-size:26rpx; font-weight:bold; color:#fff; }
.sv2-rm-close { width:40rpx;height:40rpx; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.08); border-radius:20rpx; color:#888; font-size:28rpx; }
.sv2-rm-list { max-height:400rpx; }
.sv2-rm-item { display:flex; justify-content:space-between; align-items:center; padding:14rpx; border-radius:10rpx; background:rgba(255,255,255,0.03); margin-bottom:8rpx; }
.sv2-rm-item-name { font-size:24rpx; color:#ccc; font-weight:bold; } .sv2-rm-item-cost { font-size:22rpx; color:#e74c3c; }
.sv2-none { font-size:20rpx; color:#888; text-align:center; padding:20rpx; }
</style>
