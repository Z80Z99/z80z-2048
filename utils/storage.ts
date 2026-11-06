import type { MetaState } from '../types'
import { getBestiaryId } from '../core/enemy'
import { createInitialState } from '../store/initialState'

const META_KEY = 'z80z_meta'

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && v.length < 200))] : []
}

function counts(value: unknown): Record<string, number> {
  const result: Record<string, number> = Object.create(null)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result
  for (const [key, count] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype' || key.length > 200) continue
    const id = getBestiaryId(key)
    result[id] = (result[id] || 0) + Math.floor(number(count))
  }
  return result
}

export function loadMeta(): MetaState {
  try {
    const data = uni.getStorageSync(META_KEY)
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        totalGold: Math.floor(number(parsed.totalGold)),
        totalRuns: Math.floor(number(parsed.totalRuns)),
        purchasedIds: strings(parsed.purchasedIds),
        highestDepth: Math.floor(number(parsed.highestDepth)),
        unlockedEnemies: [...new Set(strings(parsed.unlockedEnemies).map(getBestiaryId))],
        enemyKills: counts(parsed.enemyKills),
        enemyClaims: counts(parsed.enemyClaims),
        bestiaryBonusHp: number(parsed.bestiaryBonusHp),
        bestiaryBonusAtk: number(parsed.bestiaryBonusAtk),
        bestiaryClaimed: Array.isArray(parsed.bestiaryClaimed) ? parsed.bestiaryClaimed.filter((v: unknown) => typeof v === 'number' && [3, 6, 10, 13, 16].includes(v)) : [],
        globalClaimLevel: Math.floor(number(parsed.globalClaimLevel)),
      }
    }
  } catch {
    // 首次运行或旧存档损坏时使用安全默认值，不覆盖原存档。
  }
  return createInitialState().meta
}

export function saveMeta(meta: MetaState): void {
  try {
    uni.setStorageSync(META_KEY, JSON.stringify(meta))
  } catch (error) {
    console.error('Failed to save meta state:', error)
  }
}
