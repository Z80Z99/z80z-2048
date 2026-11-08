import type { BattleState, ConsumableDef, Screen } from '../types'
import { validateCard, validateCardEffect } from './cardEffects'

export const CONSUMABLE_POOL: ConsumableDef[] = [
  {
    id: 'tactical_potion', name: '战术药剂', description: '仅本回合可行动步数 +2，下一回合失效。',
    cardClass: 'blue', duration: 'round', icon: 'time', price: 35,
    effects: [{ type: 'bonusTurns', value: 2, polarity: 'positive', scope: 'parameter', description: '仅本回合可行动步数 +2' }],
  },
  {
    id: 'charge_potion', name: '蓄能药剂', description: '仅本回合后续合并攻击积蓄系数 +50%，不追溯已积蓄攻击，下一回合失效。',
    cardClass: 'blue', duration: 'round', icon: 'attack', price: 35,
    effects: [{ type: 'mergeCoefficient', value: 0.5, polarity: 'positive', scope: 'parameter', description: '仅本回合后续合并攻击积蓄系数 +50%，不追溯已有攻击' }],
  },
  {
    id: 'combo_scroll', name: '连锁卷轴', description: '本场战斗连续合并时，每层连锁额外积蓄 8 点攻击；未合并则连锁归零，战斗结束失效。',
    cardClass: 'gold', duration: 'battle', icon: 'attack', price: 60,
    effects: [{ type: 'comboBonus', value: 8, polarity: 'positive', scope: 'mechanic', description: '本场战斗连续合并时，每层连锁额外积蓄 8 点攻击；未合并则连锁归零' }],
  },
  {
    id: 'berserk_potion', name: '狂战药剂', description: '仅本回合爆发攻击系数 +100%，但承受敌人攻击伤害系数 +30%；下一回合同时失效。',
    cardClass: 'red', duration: 'round', icon: 'attack', price: 45,
    effects: [
      { type: 'burstCoefficient', value: 1, polarity: 'positive', scope: 'mechanic', description: '仅本回合爆发攻击系数 +100%' },
      { type: 'vulnerability', value: 0.3, polarity: 'negative', scope: 'mechanic', description: '仅本回合承受敌人攻击伤害系数 +30%' },
    ],
  },
  {
    id: 'cleanse_potion', name: '净化药剂', description: '立即移除一份紫色诅咒，不能移除黑色宿命；仅可在路线、商店或营地使用，战斗中不可净化。',
    cardClass: 'gold', duration: 'instant', icon: 'ward', price: 50, effects: [], cleanse: true,
  },
]

export function validateConsumable(def: unknown): def is ConsumableDef {
  if (!def || typeof def !== 'object') return false
  const item = def as ConsumableDef
  if (!Number.isFinite(item.price) || item.price <= 0 || !['round', 'battle', 'instant'].includes(item.duration)) return false
  if (!['blue', 'gold', 'red'].includes(item.cardClass) || !Array.isArray(item.effects)) return false
  if (item.cleanse) {
    return item.cardClass === 'gold' && item.duration === 'instant' && item.effects.length === 0 &&
      [item.id, item.name, item.description, item.icon].every(value => typeof value === 'string' && value.trim().length > 0)
  }
  if (item.duration === 'instant' || !item.effects.every(validateCardEffect)) return false
  return validateCard({
    id: item.id, name: item.name, description: item.description, icon: item.icon,
    cardClass: item.cardClass, kind: 'persistent', effects: item.effects,
  })
}

if (CONSUMABLE_POOL.some(def => !validateConsumable(def)) || new Set(CONSUMABLE_POOL.map(def => def.id)).size !== CONSUMABLE_POOL.length) {
  throw new Error('消耗品定义不符合六色分类规则或编号重复')
}
const CONSUMABLE_BY_ID = new Map(CONSUMABLE_POOL.map(def => [def.id, def]))

export function consumableById(id: string): ConsumableDef | undefined {
  return CONSUMABLE_BY_ID.get(id)
}

export function consumableUseDisabledReason(
  def: ConsumableDef,
  screen: Screen,
  battlePhase: BattleState['phase'] | null | undefined,
  hasPurple: boolean,
): string | null {
  if (!validateConsumable(def)) return '未知或无效的消耗品'
  if (def.cleanse) {
    if (!['route', 'shop', 'rest'].includes(screen)) return '净化只能在路线、商店或营地进行'
    if (!hasPurple) return '没有可净化的紫色诅咒，黑色宿命无法移除'
    return null
  }
  if (screen !== 'battle' || battlePhase !== 'playing') return '仅可在回合行动中使用此消耗品'
  return null
}
