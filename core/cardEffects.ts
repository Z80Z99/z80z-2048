import type { ActiveUpgrade, CardClass, CardEffect, CardModifiers, PlayerStats, UpgradeDef } from '../types'

const EFFECT_RULES: Record<CardEffect['type'], { scope: CardEffect['scope']; polarity: CardEffect['polarity'] }> = {
  attackBonus: { scope: 'stat', polarity: 'positive' },
  defenseBonus: { scope: 'stat', polarity: 'positive' },
  maxHpBonus: { scope: 'stat', polarity: 'positive' },
  goldBonus: { scope: 'stat', polarity: 'positive' },
  xpBonus: { scope: 'stat', polarity: 'positive' },
  heal: { scope: 'stat', polarity: 'positive' },
  bonusTurns: { scope: 'parameter', polarity: 'positive' },
  mergeCoefficient: { scope: 'parameter', polarity: 'positive' },
  spawnArmor: { scope: 'parameter', polarity: 'positive' },
  startingPoints: { scope: 'parameter', polarity: 'positive' },
  chargeStart: { scope: 'parameter', polarity: 'positive' },
  spawnLuck: { scope: 'parameter', polarity: 'positive' },
  halveShield: { scope: 'parameter', polarity: 'positive' },
  comboBonus: { scope: 'mechanic', polarity: 'positive' },
  mergeArmor: { scope: 'mechanic', polarity: 'positive' },
  armorCarry: { scope: 'mechanic', polarity: 'positive' },
  lifestealRating: { scope: 'mechanic', polarity: 'positive' },
  burstCoefficient: { scope: 'mechanic', polarity: 'positive' },
  extraStrikeRating: { scope: 'mechanic', polarity: 'positive' },
  comboGrace: { scope: 'mechanic', polarity: 'positive' },
  executeRating: { scope: 'mechanic', polarity: 'positive' },
  critRating: { scope: 'mechanic', polarity: 'positive' },
  savedStepsCharge: { scope: 'mechanic', polarity: 'positive' },
  greedRating: { scope: 'mechanic', polarity: 'positive' },
  vulnerability: { scope: 'mechanic', polarity: 'negative' },
  bleed: { scope: 'mechanic', polarity: 'negative' },
  backlash: { scope: 'mechanic', polarity: 'negative' },
  burn: { scope: 'mechanic', polarity: 'negative' },
  healingPenalty: { scope: 'mechanic', polarity: 'negative' },
  chargeLoss: { scope: 'mechanic', polarity: 'negative' },
  soulRecoil: { scope: 'mechanic', polarity: 'negative' },
  enemyRegen: { scope: 'mechanic', polarity: 'negative' },
  heavyLegs: { scope: 'mechanic', polarity: 'negative' },
  armorErosion: { scope: 'mechanic', polarity: 'negative' },
  enemyRage: { scope: 'mechanic', polarity: 'negative' },
}

const CLASSES: CardClass[] = ['white', 'blue', 'gold', 'red', 'purple', 'black']
const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

export function validateCardEffect(effect: unknown): effect is CardEffect {
  if (!effect || typeof effect !== 'object') return false
  const candidate = effect as CardEffect
  if (!Object.prototype.hasOwnProperty.call(EFFECT_RULES, candidate.type)) return false
  const rule = EFFECT_RULES[candidate.type]
  return Number.isFinite(candidate.value) && candidate.value > 0 &&
    candidate.scope === rule.scope && candidate.polarity === rule.polarity && hasText(candidate.description)
}

// 红卡的正面机制必须显著：爆发或追加攻击评级至少 1，吸血评级至少 0.5。
function isStrongMechanic(effect: CardEffect): boolean {
  return (effect.type === 'burstCoefficient' || effect.type === 'extraStrikeRating' || effect.type === 'executeRating' || effect.type === 'greedRating') ? effect.value >= 1 :
    effect.type === 'lifestealRating' && effect.value >= 0.5
}

export function validateCard(def: unknown): def is UpgradeDef {
  if (!def || typeof def !== 'object') return false
  const card = def as UpgradeDef
  if (!hasText(card.id) || !hasText(card.name) || !hasText(card.description) || !hasText(card.icon)) return false
  if (!CLASSES.includes(card.cardClass) || (card.kind !== 'persistent' && card.kind !== 'instant')) return false
  if ('rarity' in card || 'effect' in card || 'maxStacks' in card) return false
  if (!Array.isArray(card.effects) || card.effects.length === 0 || !card.effects.every(validateCardEffect)) return false
  if (new Set(card.effects.map(effect => effect.type)).size !== card.effects.length) return false
  if (card.kind === 'instant') {
    return card.cardClass === 'white' && card.effects.length === 1 && card.effects[0].type === 'heal'
  }
  if (card.effects.some(effect => effect.type === 'heal')) return false
  switch (card.cardClass) {
    case 'white': return card.effects.every(effect => effect.scope === 'stat')
    case 'blue': return card.effects.every(effect => effect.scope === 'parameter')
    case 'gold': return card.effects.every(effect => effect.scope === 'mechanic' && effect.polarity === 'positive')
    case 'red': {
      if (card.effects.length !== 2 || !card.effects.every(effect => effect.scope === 'mechanic')) return false
      const positives = card.effects.filter(effect => effect.polarity === 'positive')
      const negatives = card.effects.filter(effect => effect.polarity === 'negative')
      return positives.length === 1 && negatives.length === 1 && isStrongMechanic(positives[0])
    }
    case 'purple':
    case 'black': return card.effects.every(effect => effect.scope === 'mechanic' && effect.polarity === 'negative')
  }
}

export function canRemoveCard(def: UpgradeDef, method: 'shop' | 'cleanse'): boolean {
  if (!validateCard(def) || def.kind !== 'persistent' || def.cardClass === 'black') return false
  if (method === 'cleanse') return def.cardClass === 'purple'
  if (method === 'shop') return def.cardClass !== 'purple'
  return false
}

export function emptyCardModifiers(): CardModifiers {
  return {
    attackBonus: 0, defenseBonus: 0, maxHpBonus: 0, goldBonus: 0, xpBonus: 0,
    bonusTurns: 0, mergeCoefficient: 0, spawnArmor: 0, startingPoints: 0,
    chargeStart: 0, spawnLuck: 0, halveShield: 0,
    comboBonus: 0, mergeArmor: 0, armorCarry: 0, lifestealRating: 0,
    burstCoefficient: 0, vulnerability: 0, bleed: 0, extraStrikeRating: 0,
    comboGrace: 0, executeRating: 0, critRating: 0, savedStepsCharge: 0, greedRating: 0,
    backlash: 0, burn: 0, healingPenalty: 0, chargeLoss: 0, soulRecoil: 0, enemyRegen: 0,
    heavyLegs: 0, armorErosion: 0, enemyRage: 0,
  }
}

// 数值记录为正的强度；正负效果由 type 的机制定义，不通过负数伪装。
export function modifiersFromEffects(effects: CardEffect[]): Partial<CardModifiers> {
  const modifiers: Partial<CardModifiers> = {}
  for (const effect of effects) {
    if (!validateCardEffect(effect) || effect.type === 'heal') continue
    modifiers[effect.type] = (modifiers[effect.type] ?? 0) + effect.value
  }
  return modifiers
}

export function collectCardModifiers(upgrades: ActiveUpgrade[]): CardModifiers {
  const modifiers = emptyCardModifiers()
  // 按定义和持有数量计算，绝不按数量展开成数组，也不改写卡牌或玩家。
  for (const { def, count } of upgrades) {
    if (def.kind !== 'persistent' || !Number.isSafeInteger(count) || count <= 0) continue
    for (const effect of def.effects) {
      if (!validateCardEffect(effect) || effect.type === 'heal') continue
      modifiers[effect.type] += effect.value * count
    }
  }
  return modifiers
}

export function deriveCardPlayer(rawPlayer: PlayerStats, upgrades: ActiveUpgrade[]): PlayerStats {
  const modifiers = collectCardModifiers(upgrades)
  return {
    ...rawPlayer,
    attackMultiplier: rawPlayer.attackMultiplier + modifiers.attackBonus,
    defenseMultiplier: rawPlayer.defenseMultiplier + modifiers.defenseBonus,
    maxHp: rawPlayer.maxHp + modifiers.maxHpBonus,
    goldBoost: rawPlayer.goldBoost + modifiers.goldBonus,
    xpBoost: (rawPlayer.xpBoost ?? 0) + modifiers.xpBonus,
    bonusTurns: rawPlayer.bonusTurns + modifiers.bonusTurns,
  }
}
