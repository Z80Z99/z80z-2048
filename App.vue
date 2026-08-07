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
</style>
