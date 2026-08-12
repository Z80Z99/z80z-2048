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

</style>
