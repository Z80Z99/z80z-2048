<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useGameStore } from './store/gameStore'

onLaunch(() => {
  useGameStore().loadMeta()
})
</script>

<style lang="scss">
@import './uni.scss';

/* 颜色只在主题层定义。阶段改变石材与金属色，属性的语义色始终不变。 */
.game-container {
  --bg: #11120f;
  --surface: #20221d;
  --surface-raised: #2b2d26;
  --surface-soft: #181a16;
  --line: #48483b;
  --accent: #d5b17b;
  --accent-soft: rgba(213, 177, 123, 0.12);
  --text: #f2eadb;
  --muted: #b9b2a5;
  --dim: #999587;
  --gold: #e8bf72;
  --hp: #85cfaa;
  --attack: #f39589;
  --defense: #91bfea;
  --speed: #7cd1cb;
  --xp: #c8a6ed;
  --gold-soft: rgba(232, 191, 114, 0.1);
  --hp-soft: rgba(133, 207, 170, 0.1);
  --attack-soft: rgba(243, 149, 137, 0.1);
  --defense-soft: rgba(145, 191, 234, 0.1);
  --speed-soft: rgba(124, 209, 203, 0.1);
  --xp-soft: rgba(200, 166, 237, 0.1);
  --on-accent: #22190d;
  --overlay: rgba(5, 7, 6, 0.78);
  --shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.22);
  --track: rgba(128, 128, 128, 0.16);
  --rarity-common: var(--muted);
  --rarity-rare: var(--defense);
  --rarity-epic: var(--xp);
  --tile-stone: #3b4137;
  --tile-slate: #505449;
  --tile-text: #fff4df;
  --tile-time: 150ms;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --viewport-height: 100vh;
  /* #ifdef H5 */
  --viewport-height: calc(100vh - var(--window-top, 0px) - var(--window-bottom, 0px));
  /* #endif */
  min-height: var(--viewport-height);
  color: var(--text);
  background: var(--bg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 28rpx;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
.game-container.stage-2 {
  --bg: #15111e;
  --surface: #231d30;
  --surface-raised: #30283e;
  --surface-soft: #1b1626;
  --line: #4e425f;
  --accent: #c4a9e8;
  --accent-soft: rgba(196, 169, 232, 0.12);
  --tile-stone: #42384f;
  --tile-slate: #55465f;
}
.game-container.stage-3 {
  --bg: #1b1211;
  --surface: #2c1f1b;
  --surface-raised: #3b2923;
  --surface-soft: #221715;
  --line: #63483b;
  --accent: #efa77e;
  --accent-soft: rgba(239, 167, 126, 0.12);
  --tile-stone: #4b3731;
  --tile-slate: #604638;
}
.game-container.theme-light {
  --bg: #f0eadf;
  --surface: #fffbf3;
  --surface-raised: #eae2d3;
  --surface-soft: #e8e2d5;
  --line: #c9bea9;
  --accent: #855b29;
  --accent-soft: rgba(133, 91, 41, 0.08);
  --text: #302d26;
  --muted: #655e52;
  --dim: #70695d;
  --gold: #885909;
  --hp: #226b48;
  --attack: #b33c35;
  --defense: #2b6097;
  --speed: #1f6969;
  --xp: #76509b;
  --gold-soft: rgba(136, 89, 9, 0.07);
  --hp-soft: rgba(34, 107, 72, 0.07);
  --attack-soft: rgba(179, 60, 53, 0.07);
  --defense-soft: rgba(43, 96, 151, 0.07);
  --speed-soft: rgba(31, 105, 105, 0.07);
  --xp-soft: rgba(118, 80, 155, 0.07);
  --on-accent: #fffbf3;
  --overlay: rgba(29, 25, 21, 0.55);
  --shadow: 0 16rpx 48rpx rgba(66, 51, 27, 0.12);
  --tile-stone: #e0d8c7;
  --tile-slate: #cfc3ab;
  --tile-text: #302d26;
}
.game-container.theme-light.stage-2 {
  --bg: #eee8f3;
  --surface: #fcf8ff;
  --surface-raised: #e7deef;
  --surface-soft: #e6deed;
  --line: #c5b4d4;
  --accent: #735193;
  --accent-soft: rgba(115, 81, 147, 0.08);
  --tile-stone: #e0d5e8;
  --tile-slate: #cbbbd8;
}
.game-container.theme-light.stage-3 {
  --bg: #f2e5db;
  --surface: #fff8f1;
  --surface-raised: #ead9ca;
  --surface-soft: #eadacd;
  --line: #d0af98;
  --accent: #a0502d;
  --accent-soft: rgba(160, 80, 45, 0.08);
  --tile-stone: #e4cfc0;
  --tile-slate: #d6b59c;
}

/* 公共原语：只用类选择器，便于编译进 uni-app / 微信组件。 */
.screen { width: 100%; min-height: var(--viewport-height); box-sizing: border-box; padding: 32rpx 28rpx calc(152rpx + var(--safe-bottom)); background: var(--bg); }
.ui-page { width: 100%; max-width: 720px; box-sizing: border-box; margin: 0 auto; }
.ui-kicker { display: block; color: var(--accent); font-size: 24rpx; font-weight: 700; letter-spacing: 4rpx; }
.ui-title { display: block; font-size: 46rpx; line-height: 1.3; font-weight: 800; letter-spacing: 2rpx; color: var(--text); }
.ui-body { display: block; color: var(--muted); font-size: 28rpx; line-height: 1.7; }
.ui-note { display: block; font-size: 26rpx; line-height: 1.6; color: var(--muted); }
.ui-card { box-sizing: border-box; background: var(--surface); border: 1px solid var(--line); border-radius: 20rpx; box-shadow: var(--shadow); }
.ui-btn { box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 10rpx; min-height: 88rpx; margin: 0; padding: 20rpx 28rpx; font: inherit; font-size: 28rpx; line-height: 1.45; font-weight: 700; border-radius: 14rpx; border: 1px solid var(--accent); background: var(--accent); color: var(--on-accent); text-align: center; transition: transform 120ms ease, opacity 120ms ease; }
.ui-btn::after { border: none; }
.ui-btn:active { transform: translateY(2rpx); }
.ui-btn-secondary { background: var(--surface); color: var(--text); border-color: var(--line); }
.ui-btn-quiet { background: transparent; color: var(--muted); border-color: var(--line); }
.ui-btn[disabled], .ui-disabled { color: var(--muted); background: var(--surface-soft); border-color: var(--line); }
/* uni-button 的原生 disabled 默认底色为白色，主题规则需有更高的优先级。 */
.game-container [role="button"][disabled] { color: var(--muted) !important; background: var(--surface-soft) !important; border-color: var(--line); opacity: 1; box-shadow: none; }
.ui-btn[disabled]:active { transform: none; }
.ui-close { box-sizing: border-box; display: flex; justify-content: center; align-items: center; flex-shrink: 0; min-width: 80rpx; min-height: 72rpx; margin: 0; padding: 10rpx 18rpx; border: 1px solid var(--line); border-radius: 12rpx; background: var(--surface-raised); color: var(--text); font-size: 26rpx; line-height: 1.3; }
.ui-close::after { border: none; }
.ui-overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 28rpx; background: var(--overlay); animation: ui-fade-in 160ms ease-out; }
.ui-dialog { width: 100%; max-width: 600px; max-height: calc(90vh - var(--safe-bottom)); box-sizing: border-box; overflow-y: auto; padding: 32rpx; border: 1px solid var(--line); border-radius: 24rpx; background: var(--surface); box-shadow: var(--shadow); animation: ui-rise-in 200ms ease-out; }
.ui-sheet-overlay { align-items: flex-end; padding: 0; }
.ui-sheet { position: relative; width: 100%; max-width: 760px; height: 86vh; max-height: calc(100vh - 40rpx); box-sizing: border-box; display: flex; flex-direction: column; padding: 28rpx 28rpx calc(24rpx + var(--safe-bottom)); border: 1px solid var(--line); border-bottom: none; border-radius: 28rpx 28rpx 0 0; background: var(--surface); box-shadow: var(--shadow); animation: ui-rise-in 220ms ease-out; }
.ui-sheet-header { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; margin-bottom: 24rpx; flex-shrink: 0; }
.ui-sheet-title { display: block; font-size: 36rpx; line-height: 1.4; font-weight: 800; color: var(--text); }
.ui-scroll { flex: 1; min-height: 0; height: 0; }
.ui-badge { display: inline-flex; align-items: center; padding: 4rpx 12rpx; border: 1px solid var(--line); border-radius: 8rpx; color: var(--accent); background: var(--accent-soft); font-size: 24rpx; line-height: 1.5; }
.ui-divider { height: 1px; background: var(--line); margin: 24rpx 0; }
.stat-gold { color: var(--gold); }
.stat-hp { color: var(--hp); }
.stat-attack { color: var(--attack); }
.stat-defense { color: var(--defense); }
.stat-speed { color: var(--speed); }
.stat-xp { color: var(--xp); }

/* 静态雕版卡面：背景本身绘制护角，不建立定位上下文、不遮挡交互。 */
.art-card {
  background-color: var(--surface);
  background-image:
    linear-gradient(var(--accent), var(--accent)), linear-gradient(var(--accent), var(--accent)),
    linear-gradient(var(--accent), var(--accent)), linear-gradient(var(--accent), var(--accent)),
    linear-gradient(var(--accent), var(--accent)), linear-gradient(var(--accent), var(--accent)),
    linear-gradient(var(--accent), var(--accent)), linear-gradient(var(--accent), var(--accent)),
    linear-gradient(135deg, var(--accent-soft), transparent 42%, var(--accent-soft));
  background-size: 20rpx 1px, 1px 20rpx, 20rpx 1px, 1px 20rpx, 20rpx 1px, 1px 20rpx, 20rpx 1px, 1px 20rpx, 100% 100%;
  background-position: left 8rpx top 8rpx, left 8rpx top 8rpx, right 8rpx top 8rpx, right 8rpx top 8rpx, left 8rpx bottom 8rpx, left 8rpx bottom 8rpx, right 8rpx bottom 8rpx, right 8rpx bottom 8rpx, center;
  background-repeat: no-repeat;
}
.art-paper-label { display: inline-flex; align-items: center; width: fit-content; max-width: 100%; box-sizing: border-box; padding: 2rpx 10rpx; border: 1px solid var(--line); border-radius: 4rpx; background: var(--accent-soft); color: var(--accent); line-height: 1.5; }
.art-scene { display: block; width: 100%; height: 160rpx; box-sizing: border-box; border: 1px solid var(--line); border-radius: 16rpx; background: var(--surface-soft); pointer-events: none; }
@media (max-height: 700px) { .art-scene { height: 112rpx; } }
@media (max-height: 560px) { .art-scene { height: 80rpx; } }

/* 动画集中定义，避免重复 keyframes 覆盖及微信组件作用域差异。 */
@keyframes ui-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ui-rise-in { from { opacity: 0; transform: translateY(16rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes tile-appear { from { opacity: 0; transform: scale(0.65); } to { opacity: 1; transform: scale(1); } }
@keyframes tile-merge { 0% { transform: scale(1); } 45% { transform: scale(1.13); } 100% { transform: scale(1); } }
@keyframes tile-spark { from { opacity: 0.6; transform: scale(0.75); } to { opacity: 0; transform: scale(1.5); } }
@keyframes enemy-hit { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5rpx); } 65% { transform: translateX(4rpx); } }
@media (prefers-reduced-motion: reduce) {
  .game-container { --tile-time: 0ms; }
  .ui-overlay, .ui-dialog, .ui-sheet, .ui-btn { animation: none; transition: none; }
}
</style>
