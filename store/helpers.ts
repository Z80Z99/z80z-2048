import type { GameState, ActiveUpgrade, UpgradeDef, CardClass } from '../types'
import { createInitialState } from './initialState'
import { pickUpgrades, UPGRADE_POOL } from '../core/upgrade'
import { collectCardModifiers } from '../core/cardEffects'
import { CONSUMABLE_POOL } from '../core/consumables'
import { ALL_EQUIPMENT, makeEquipId } from '../core/equipment'

export function xpToNext(level: number): number {
  return 25 + (level - 1) * 12
}

export function getStartingPoints(upgrades: ActiveUpgrade[]): number {
  return collectCardModifiers(upgrades).startingPoints
}

export function applyMetaUpgrades(meta: GameState['meta']) {
  let maxHpBonus = meta.bestiaryBonusHp
  let atkBonus = meta.bestiaryBonusAtk
  if (meta.purchasedIds.includes('meta_hp_1')) maxHpBonus += 10
  if (meta.purchasedIds.includes('meta_hp_2')) maxHpBonus += 10
  if (meta.purchasedIds.includes('meta_atk_1')) atkBonus += 0.1
  if (meta.purchasedIds.includes('meta_atk_2')) atkBonus += 0.1
  const init = createInitialState().player
  return { maxHp: init.maxHp + maxHpBonus, hp: init.maxHp + maxHpBonus, attackMultiplier: init.attackMultiplier + atkBonus }
}

export function rollRewardChoices(
  rng: () => number,
  _upgrades: { def: { id: string }; count: number }[] = [],
  opts: { count?: number; excludeHeal?: boolean; hpRatio?: number; allowedClasses?: CardClass[] } = {},
): UpgradeDef[] {
  return pickUpgrades(rng, opts)
}

export function instantSupplyCost(def?: UpgradeDef): number {
  return def?.id === 'heal_2' ? 50 : 20
}

export function buildShop(
  rng: () => number,
  stage: number,
  _activeUpgrades: { def: { id: string }; count: number }[] = [],
) {
  const cards = pickUpgrades(rng, { count: 3, excludeHeal: true, allowedClasses: ['white', 'blue', 'gold'] })
  const shopUpgrades: (string | null)[] = [null, null, null]
  cards.forEach((card, index) => { shopUpgrades[index] = card.id })
  const pool = [...ALL_EQUIPMENT]
  const shopEquipment: (string | null)[] = [null, null, null]
  for (let i = 0; i < 3 && pool.length; i++) {
    const index = Math.floor(rng() * pool.length)
    const level = (stage - 1) * 2 + 1 + Math.floor(rng() * 2)
    shopEquipment[i] = makeEquipId(pool[index].id, level, undefined, rng)
    pool.splice(index, 1)
  }
  const healPool = UPGRADE_POOL.filter(card => card.kind === 'instant')
  const shopHeals: (string | null)[] = [healPool.length ? healPool[Math.floor(rng() * healPool.length)].id : null]
  const supplies = [...CONSUMABLE_POOL]
  const shopConsumables: (string | null)[] = []
  for (let i = 0; i < 2 && supplies.length; i++) {
    const index = Math.floor(rng() * supplies.length)
    shopConsumables.push(supplies[index].id)
    supplies.splice(index, 1)
  }
  return { shopUpgrades, shopEquipment, shopHeals, shopConsumables, shopRefreshCost: 10, shopRemoveCost: 30, shopRemoveUsed: false }
}
