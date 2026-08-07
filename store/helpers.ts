import type { GameState, ActiveUpgrade, UpgradeDef } from '../types'
import { createInitialState } from './initialState'
import { pickUpgrades, UPGRADE_POOL } from '../core/upgrade'
import { ALL_EQUIPMENT, makeEquipId } from '../core/equipment'

export function xpToNext(level: number): number {
  return 25 + (level - 1) * 12
}

export function getStartingTileBonuses(upgrades: ActiveUpgrade[]): number[] {
  const values: number[] = []
  for (const u of upgrades) {
    if (u.def.effect.type === 'starting_tile') {
      for (let i = 0; i < u.count; i++) {
        values.push(u.def.effect.value ?? 0)
      }
    }
  }
  return values
}

export function applyMetaUpgrades(meta: GameState['meta']) {
  let maxHpBonus = meta.bestiaryBonusHp
  let atkBonus = meta.bestiaryBonusAtk

  if (meta.purchasedIds.includes('meta_hp_1')) { maxHpBonus += 10 }
  if (meta.purchasedIds.includes('meta_hp_2')) { maxHpBonus += 10 }
  if (meta.purchasedIds.includes('meta_atk_1')) { atkBonus += 0.1 }
  if (meta.purchasedIds.includes('meta_atk_2')) { atkBonus += 0.1 }

  const initState = createInitialState()
  return {
    maxHp: initState.player.maxHp + maxHpBonus,
    hp: initState.player.maxHp + maxHpBonus,
    attackMultiplier: initState.player.attackMultiplier + atkBonus,
  }
}

export function rollRewardChoices(
  rng: () => number,
  upgrades: { def: { id: string }; count: number }[],
  opts: { count?: number; excludeHeal?: boolean; hpRatio?: number; minRarity?: 'common' | 'rare' | 'epic' } = {},
): UpgradeDef[] {
  const activeIds = upgrades.map(u => u.def.id)
  const activeCounts: Record<string, number> = {}
  for (const u of upgrades) {
    activeCounts[u.def.id] = u.count
  }
  return pickUpgrades(
    rng,
    activeIds,
    activeCounts,
    opts.count ?? 3,
    opts.excludeHeal ?? false,
    opts.hpRatio ?? 1,
    opts.minRarity,
  )
}

export function buildShop(
  rng: () => number,
  stage: number,
  activeUpgrades: { def: { id: string }; count: number }[] = [],
) {
  const activeIds = activeUpgrades.map(u => u.def.id)
  const activeCounts: Record<string, number> = {}
  for (const u of activeUpgrades) {
    activeCounts[u.def.id] = u.count
  }
  const upgrades = pickUpgrades(rng, activeIds, activeCounts, 3, true, 1).map(u => u.id)
  const padUpgrades: (string | null)[] = [null, null, null]
  for (let i = 0; i < Math.min(3, upgrades.length); i++) {
    padUpgrades[i] = upgrades[i]
  }

  const eqPool = [...ALL_EQUIPMENT]
  const eqSlots: (string | null)[] = [null, null, null]
  for (let i = 0; i < 3 && eqPool.length > 0; i++) {
    const idx = Math.floor(rng() * eqPool.length)
    // level keeps Math.random semantics (matches original rollEquipLevel)
    const level = (stage - 1) * 2 + 1 + Math.floor(Math.random() * 2)
    eqSlots[i] = makeEquipId(eqPool[idx].id, level)
    eqPool.splice(idx, 1)
  }

  const healPool = UPGRADE_POOL.filter(u => u.effect.type === 'heal')
  const healSlots: (string | null)[] = healPool.length > 0
    ? [healPool[Math.floor(rng() * healPool.length)].id]
    : [null]

  return {
    shopUpgrades: padUpgrades,
    shopEquipment: eqSlots,
    shopHeals: healSlots,
    shopRefreshCost: 10,
    shopRemoveCost: 30,
    shopRemoveUsed: false,
  }
}
