<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useGameStore } from './store/gameStore'

onLaunch(() => {
  const store = useGameStore()
  store.loadMeta()
})
</script>

<style lang="scss">
@import './uni.scss';

/* ======== GLOBAL SHARED ANIMATIONS ========
   寰俊灏忕▼搴忎腑 @keyframes 鍙湪鍚屾枃浠?鍏ㄥ眬(app.wxss)浣滅敤鍩熺敓鏁堬紝
   鑷畾涔夌粍浠跺姩鐢诲紩鐢ㄧ殑 keyframes 蹇呴』瀹氫箟鍦?App.vue 杩欓噷銆?   (椤哄簭鏁忔劅: 鍚庡畾涔夌殑 card-pop 瑕嗙洊鍓嶈€咃紝淇濇寔鍘熷椤哄簭) */
@keyframes title-glow { 0%,100% { text-shadow: 0 0 20px rgba(241,196,15,0.3), 0 0 40px rgba(241,196,15,0.1); } 50% { text-shadow: 0 0 40px rgba(241,196,15,0.6), 0 0 80px rgba(241,196,15,0.3), 0 0 120px rgba(241,196,15,0.15); } }
@keyframes title-fade { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes panel-slide-in { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes panel-slide-out { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
@keyframes hp-glow { 0%, 100% { box-shadow: 0 0 8rpx rgba(46,204,113,0.3); } 50% { box-shadow: 0 0 16rpx rgba(46,204,113,0.5); } }
@keyframes card-pop { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }
@keyframes screen-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
@keyframes layer-rise { from { opacity: 0; transform: translateY(30rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes node-active-glow { 0%,100% { box-shadow: 0 0 8rpx rgba(255,255,255,0.05); } 50% { box-shadow: 0 0 24rpx rgba(255,255,255,0.12); } }
@keyframes screen-enter { from { opacity: 0; filter: brightness(1.5); } to { opacity: 1; filter: brightness(1); } }
@keyframes overlay-in { 0% { opacity: 0 } 100% { opacity: 1 } }
@keyframes card-pop { 0% { opacity: 0; transform: scale(0.8) translateY(30rpx); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes heal-pulse { 0%,100% { text-shadow: 0 0 10px rgba(46,204,113,0.3); } 50% { text-shadow: 0 0 30px rgba(46,204,113,0.7), 0 0 60px rgba(46,204,113,0.3); } }
@keyframes gameover-shake { 0%,100% { transform: translateX(0); } 10%,50%,90% { transform: translateX(-5px); } 30%,70% { transform: translateX(5px); } }
@keyframes boss-victory { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
@keyframes shop-card-in { from { opacity: 0; transform: translateY(30rpx) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }



/* ======== GLOBAL RESETS & THEMES ========
   HBuilderX 对 main.js 中 import scss 的编译会导致页面初始化中断（渲染层 FLOW_DEPTH 卡死），
   因此全局规则放在 App.vue（页面 wxss 会有 tag selector 警告，属无害噪音）。
   注意：App.vue 样式会被复制进页面 wxss，此处只允许类选择器与 keyframes。 */
// global.scss 鈥?搴旂敤绾у叏灞€鏍峰紡锛堝湪 main.js 涓?import锛?// 鍙紪璇戣繘 app.wxss锛屼笉浼氳繘鍏ラ〉闈?缁勪欢 wxss銆?// 娉ㄦ剰锛氬井淇″皬绋嬪簭绂佹椤甸潰/缁勪欢 wxss 涓嚭鐜版爣绛鹃€夋嫨鍣紙page銆乿iew銆乼ext 绛夛級锛?// 鍥犳杩欑被瑙勫垯蹇呴』鏀惧湪杩欓噷锛岃€屼笉鑳芥斁鍦?App.vue 鐨?<style>锛堜細琚鍒惰繘椤甸潰 wxss锛夈€?// 鍏变韩 @keyframes 浠嶅湪 App.vue锛堥潪閫夋嫨鍣紝鏃犻檺鍒讹級銆?
page {
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  font-size: 14px;
  color: #ccc;
  background: #0d0d1a;
  -webkit-font-smoothing: antialiased;
  margin: 0; padding: 0;
}

view, text, button { box-sizing: border-box; }

/* ======== LIGHT THEME ======== */
.theme-light page { background: #f5f0e8; color: #3e3640; }
.theme-light .game-container { background: #f5f0e8; }
.theme-light .screen, .theme-light .battle-screen { background: #f5f0e8; }
.theme-light .title-screen { background: #f5f0e8; }
.theme-light .title-main { color: #3e3640 !important; }
.theme-light .title-sub { color: #8a8278 !important; }
.theme-light .menu-btn-secondary { color: #5a5258 !important; border-color: #5a5258; }

/* StatusBar */
.theme-light .status-bar { background: #fff; border-color: rgba(0,0,0,0.06); }
.theme-light .sb-hp-label, .theme-light .sb-turns-label, .theme-light .sb-stat-label { color: #8a8278; }
.theme-light .sb-hp-val, .theme-light .sb-turns-num, .theme-light .sb-stat-val { color: #3e3640; }
.theme-light .sb-gold-val { color: #b8860b; }
.theme-light .sb-hp-bar { background: rgba(0,0,0,0.06); }
.theme-light .sb-xp-bar { background: rgba(0,0,0,0.06); }
.theme-light .sb-stat-block, .theme-light .sb-turns-block { background: rgba(0,0,0,0.02); border-color: rgba(0,0,0,0.04); }

/* EnemyDisplay */
.theme-light .enemy-card { background: #fff; border-color: rgba(0,0,0,0.06); }
.theme-light .enemy-name, .theme-light .enemy-hp-num, .theme-light .enemy-stat-base { color: #3e3640; }
.theme-light .enemy-hp-track { background: rgba(0,0,0,0.04); }
.theme-light .enemy-stat-label { color: #8a8278; }
.theme-light .enemy-stat-box { background: rgba(0,0,0,0.02); }

/* Route */
.theme-light .route-page { background: #ede8e0; }
.theme-light .route-panel-fixed { background: rgba(255,255,255,0.95); border-bottom-color: rgba(0,0,0,0.06); }
.theme-light .rp-label, .theme-light .rp-info-label, .theme-light .rp-stat-label { color: #8a8278; }
.theme-light .rp-hp-num, .theme-light .rp-info-val { color: #3e3640; }
.theme-light .rp-hp-max { color: #8a8278; }
.theme-light .rp-hp-bar, .theme-light .rp-info-xp-bar { background: rgba(0,0,0,0.06); }
.theme-light .rp-info-card, .theme-light .rp-stat-item { background: rgba(0,0,0,0.02); border-color: rgba(0,0,0,0.04); }
.theme-light .rp-stat-val { color: #3e3640; }
.theme-light .rp-up-item { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.06); }
.theme-light .rp-up-name { color: #3e3640; }
.theme-light .route-floor-text { color: #b0a89e; }
.theme-light .route-floor-line { background: rgba(0,0,0,0.06); }
.theme-light .route-node-card { background: rgba(0,0,0,0.02); }
.theme-light .rn-name { color: #3e3640; }
.theme-light .route-toggle-fab { background: rgba(255,255,255,0.85); border-color: rgba(0,0,0,0.1); }
.theme-light .route-toggle-text { color: #8a8278; }
.theme-light .layer-current .route-floor-text { color: #b8860b; }

/* Result / Round */
.theme-light .result-modal, .theme-light .round-card { background: #fff; border-color: rgba(0,0,0,0.06); }
.theme-light .result-title, .theme-light .round-title { color: #3e3640; }
.theme-light .result-phase-label, .theme-light .round-speed-who, .theme-light .round-hp-label { color: #8a8278; }
.theme-light .result-phase-val, .theme-light .round-speed-num, .theme-light .round-hp-val { color: #3e3640; }
.theme-light .result-summary-text { color: #8a8278; }
.theme-light .round-speed-bar-wrap { background: rgba(0,0,0,0.06); }
.theme-light .round-log-text { color: #5a5258; }
.theme-light .round-speed-vs { color: #b0a89e; }
.theme-light .result-overflow-label { color: #8a8278; }
.theme-light .result-continue-text { color: #3e3640; }

/* Shop */
.theme-light .sv2 { background: #f5f0e8; }
.theme-light .sv2-title { color: #3e3640; }
.theme-light .sv2-card-rarity-common, .theme-light .sv2-card-rarity-rare, .theme-light .sv2-card-rarity-epic { background: rgba(0,0,0,0.015); }
.theme-light .sv2-card-sold { background: transparent; border-color: rgba(0,0,0,0.05); }
.theme-light .sv2-sold-txt { color: #ccc; }
.theme-light .sv2-card-name { color: #3e3640; }

/* Reward / Rest / Meta / GameOver / Boss */
.theme-light .reward-card { background: rgba(0,0,0,0.03); }
.theme-light .reward-card-name { color: #3e3640; }
.theme-light .reward-card-desc { color: #8a8278; }
.theme-light .reward-title { color: #3e3640; }
.theme-light .reward-sub, .theme-light .reward-lv { color: #8a8278; }
.theme-light .reward-skip { color: #5a5258; border-color: #5a5258; }
.theme-light .rest-screen, .theme-light .meta-screen, .theme-light .gameover-screen, .theme-light .boss-choice-screen, .theme-light .reward-screen { background: #ede8e0; }
.theme-light .meta-title { color: #3e3640; }
.theme-light .meta-card { background: rgba(0,0,0,0.02); border-color: rgba(0,0,0,0.06); }
.theme-light .meta-card-name { color: #3e3640; }
.theme-light .boss-choice-title { color: #3e3640; }
.theme-light .boss-choice-stage { color: #8a8278; }
.theme-light .boss-choice-stat-val { color: #3e3640; }
.theme-light .boss-choice-stat-label, .theme-light .boss-choice-hint { color: #8a8278; }
.theme-light .boss-btn-end { color: #5a5258; border-color: rgba(0,0,0,0.15); }
.theme-light .gameover-title { color: #3e3640; }

/* Panels */
.theme-light .bestiary-panel { background: linear-gradient(180deg, #fff, #f8f6f2); }
.theme-light .bs-title { color: #3e3640; }
.theme-light .bs-card-name { color: #3e3640; }
.theme-light .bs-stat-val { color: #5a5258; }
.theme-light .equip-panel { background: linear-gradient(180deg, #f8f6f2, #f0ede8); }
.theme-light .equip-title, .theme-light .equip-inv-name, .theme-light .doll-item-name { color: #3e3640; }
.theme-light .up-panel { background: #fff; }
.theme-light .up-panel-title { color: #3e3640; }
.theme-light .up-item-name { color: #3e3640; }
.theme-light .up-item-desc { color: #8a8278; }
.theme-light .up-stat-val { color: #3e3640; }
.theme-light .up-stat-label { color: #8a8278; }
.theme-light .up-stat { background: rgba(0,0,0,0.02); }
.theme-light .rules-panel { background: #fff; }
.theme-light .rules-title, .theme-light .rules-section-title { color: #3e3640; }
.theme-light .rules-text { color: #5a5258; }
.theme-light .dbg-panel { background: #f5f0e8; }

/* Float toolbar */
.theme-light .float-btn { background: rgba(255,255,255,0.85); border-color: rgba(0,0,0,0.1); }
.theme-light .float-btn-label { color: #5a5258; }

/* Dark theme board */
.theme-dark .board { background: #1a1a2e; }
.theme-dark .cell-empty { background: rgba(255,255,255,0.05); }
.theme-dark .tile-2 .tile-inner { background: #2a2a3e; }
.theme-dark .tile-4 .tile-inner { background: #2d2d42; }
.theme-dark .tile-8 .tile-inner { background: #3d2a1a; }
.theme-dark .tile-16 .tile-inner { background: #4d2a1a; }
.theme-dark .tile-32 .tile-inner { background: #5d2018; }
.theme-dark .tile-64 .tile-inner { background: #6d1810; }
.theme-dark .tile-128 .tile-inner { background: #5d4a18; }
.theme-dark .tile-256 .tile-inner { background: #5d4818; }
.theme-dark .tile-512 .tile-inner { background: #5d4418; }
.theme-dark .tile-1024 .tile-inner { background: #5d4018; }
.theme-dark .tile-2048 .tile-inner { background: #5d3c18; }
.theme-dark .tile-2 .tile-text, .theme-dark .tile-4 .tile-text { color: #999; }

</style>
