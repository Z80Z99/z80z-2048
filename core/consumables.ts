import type { BattleState, CardModifiers, ConsumableDef, Screen, SpringWaterQuality, SpringWaterRoll, TimedEffect } from '../types'
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
  {
    id: 'spring_water', name: '泉水', description: '治愈之泉的泉水。瓶中是回血之泉，还是持续数回合的增益或异常状态，要饮用时才揭晓；能卖多少钱也要成交时才揭晓。',
    cardClass: 'gold', duration: 'instant', icon: 'ward', price: 20, effects: [], hidden: true,
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
  // 隐藏道具（泉水）的效果与价值由每件实例决定，不能静态声明效果。
  if (item.hidden) {
    return item.duration === 'instant' && item.effects.length === 0 &&
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

/** 商店回收价：原价的一半，向下取整。隐藏道具不按原价回收（泉水按每瓶自己的售价成交）。 */
export function consumableSellPrice(def: ConsumableDef): number {
  return Math.floor(def.price / 2)
}

// ====== 泉水（治愈之泉 · 装瓶带走） ======
// 每瓶的隐藏内容在事件结算时抽定：品质决定强度、持续回合与售价区间，再抽一次决定身份。
export const SPRING_WATER_ID = 'spring_water'

/** 依次为 寡淡 / 寻常 / 佳酿。 */
const SPRING_WATER_TIERS = [
  { healPercent: 8, rounds: 2, sell: [4, 8] },
  { healPercent: 18, rounds: 3, sell: [12, 20] },
  { healPercent: 30, rounds: 4, sell: [24, 36] },
] as const

interface SpringWaterStatus {
  id: string
  label: string
  polarity: 'positive' | 'negative'
  /** 修改的战斗参数。只选不消耗随机数的键，泉水不会打乱战斗内的随机序列。 */
  key: keyof CardModifiers
  /** 寡淡 / 寻常 / 佳酿 三档强度。 */
  values: readonly [number, number, number]
  describe: (value: number) => string
}
const percent = (value: number) => `${Number((value * 100).toFixed(2))}%`
const SPRING_WATER_STATUSES: readonly SpringWaterStatus[] = [
  { id: 'surge', label: '涌泉', polarity: 'positive', key: 'chargeStart', values: [6, 10, 16], describe: value => `每回合开局额外蓄力 ${value} 点` },
  { id: 'vigor', label: '泉劲', polarity: 'positive', key: 'mergeCoefficient', values: [0.15, 0.25, 0.4], describe: value => `合并获得的攻击增加${percent(value)}` },
  { id: 'aegis', label: '泉护', polarity: 'positive', key: 'spawnArmor', values: [0.6, 1, 1.5], describe: value => `新方块每点数值额外提供 ${value} 防御` },
  { id: 'scald', label: '灼泉', polarity: 'negative', key: 'burn', values: [2, 4, 6], describe: value => `每回合结束灼烧，失去 ${value} 点生命` },
  { id: 'turbid', label: '浊泉', polarity: 'negative', key: 'vulnerability', values: [0.12, 0.22, 0.35], describe: value => `受到的敌人攻击伤害增加${percent(value)}` },
  // 攻击散失按 1÷(1＋评级) 保留，文案给实际减少的比例。
  { id: 'silt', label: '滞泉', polarity: 'negative', key: 'chargeLoss', values: [0.15, 0.3, 0.45], describe: value => `后续合并积攒的攻击减少${percent(value / (1 + value))}` },
]

function springWaterTier(quality: number) {
  const tier = SPRING_WATER_TIERS[quality as SpringWaterQuality]
  if (!tier) throw new RangeError('泉水品质必须是 0、1 或 2')
  return tier
}

/** 抽 2 次：第 1 次定身份（回血 45%、增益 27.5%、异常 27.5%，并选出具体状态），第 2 次定售价。 */
export function rollSpringWater(quality: SpringWaterQuality, rng: () => number): SpringWaterRoll {
  const tier = springWaterTier(quality)
  const identity = rng()
  const sellValue = tier.sell[0] + Math.floor(rng() * (tier.sell[1] - tier.sell[0] + 1))
  if (identity < 0.45) return { kind: 'heal', quality, percent: tier.healPercent, sellValue }
  const kind = identity < 0.725 ? 'buff' : 'curse'
  const pool = SPRING_WATER_STATUSES.filter(status => status.polarity === (kind === 'buff' ? 'positive' : 'negative'))
  const offset = kind === 'buff' ? 0.45 : 0.725
  const status = pool[Math.min(pool.length - 1, Math.floor((identity - offset) / 0.275 * pool.length))]
  return { kind, quality, status: status.id, rounds: tier.rounds, value: status.values[quality], sellValue }
}

export function springWaterStatus(id: string): SpringWaterStatus | undefined {
  return SPRING_WATER_STATUSES.find(status => status.id === id)
}

/** 揭示文案：只在饮用后展示，卡面上永远是未知。 */
export function describeSpringWater(roll: SpringWaterRoll): string {
  if (roll.kind === 'heal') return `回血之泉：回复生命上限的 ${roll.percent}%`
  const status = springWaterStatus(roll.status)
  return status ? `${status.label}：${status.describe(roll.value)}，持续 ${roll.rounds} 回合` : '泉水状态未知'
}

/** 该品质的期望售价，供机器人估值。 */
export function springWaterSellExpectation(quality: SpringWaterQuality): number {
  const [min, max] = springWaterTier(quality).sell
  return (min + max) / 2
}

/** 把增益或异常状态转成持续数回合的战斗状态。 */
export function springWaterToTimedEffect(roll: Extract<SpringWaterRoll, { kind: 'buff' | 'curse' }>): TimedEffect | null {
  const status = springWaterStatus(roll.status)
  if (!status) return null
  return {
    id: `spring_${status.id}`, name: status.label, label: describeSpringWater(roll), polarity: status.polarity,
    rounds: roll.rounds, remaining: roll.rounds, modifiers: { [status.key]: roll.value },
  }
}
