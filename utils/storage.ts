import type { MetaState } from '../types'
import { createInitialState } from '../store/initialState'

const META_KEY = 'z80z_meta'

export function loadMeta(): MetaState {
  try {
    const data = uni.getStorageSync(META_KEY)
    if (data) {
      const parsed = JSON.parse(data)
      return {
        totalGold: parsed.totalGold ?? 0,
        totalRuns: parsed.totalRuns ?? 0,
        purchasedIds: parsed.purchasedIds ?? [],
        highestDepth: parsed.highestDepth ?? 0,
        unlockedEnemies: parsed.unlockedEnemies ?? [],
        enemyKills: parsed.enemyKills ?? {},
        enemyClaims: parsed.enemyClaims ?? {},
        bestiaryBonusHp: parsed.bestiaryBonusHp ?? 0,
        bestiaryBonusAtk: parsed.bestiaryBonusAtk ?? 0,
        bestiaryClaimed: parsed.bestiaryClaimed ?? [],
        globalClaimLevel: parsed.globalClaimLevel ?? 0,
      }
    }
  } catch {
    // First run
  }
  return { ...createInitialState().meta }
}

export function saveMeta(meta: MetaState): void {
  try {
    uni.setStorageSync(META_KEY, JSON.stringify(meta))
  } catch (e) {
    console.error('Failed to save meta state:', e)
  }
}
