import type { CardClass, CardEffect, CardModifiers, ConsumableDef, PlayerStats, UpgradeDef } from '../types'

export interface DisplayContext {
  /** 已持有卡牌和临时效果的总量，不是即将获得的单张增量。 */
  modifiers?: Partial<CardModifiers>
  count?: number
  effectivePlayer?: Pick<PlayerStats, 'hp' | 'maxHp'>
}
export interface SummaryLine {
  text: string
  polarity: CardEffect['polarity']
}

const numberText = (value: number) => String(Number(value.toFixed(2)))
const percentText = (value: number) => `${numberText(value * 100)}%`
const naturalFraction = (value: number) => value > 0 ? value / (1 + value) : 0
function currentTotal(effect: CardEffect, context?: DisplayContext): number | undefined {
  if (effect.type === 'heal') return undefined
  const total = context?.modifiers?.[effect.type]
  if (total !== undefined && Number.isFinite(total)) return Math.max(0, total)
  return context?.count !== undefined && context.count > 0 ? effect.value * context.count : undefined
}

/** 与普通治疗、营地治疗一致；营地的原始 30% 须由调用方先向下取整。 */
export function getActualHealGained(player: Pick<PlayerStats, 'hp' | 'maxHp'>, rawAmount: number, penalty = 0): number {
  if (!Number.isFinite(rawAmount) || rawAmount <= 0 || player.hp <= 0) return 0
  const healed = Math.floor(rawAmount / (1 + Math.max(0, penalty)))
  return Math.max(0, Math.min(player.maxHp - player.hp, healed))
}

export function summarizeEffect(effect: CardEffect, context?: DisplayContext): string {
  const value = numberText(effect.value)
  const percent = percentText(effect.value)
  const total = currentTotal(effect, context)
  const fraction = total === undefined ? undefined : percentText(naturalFraction(total))
  switch (effect.type) {
    case 'attackBonus': return `攻击增强${percent}`
    case 'defenseBonus': return `防御增强${percent}`
    case 'maxHpBonus': {
      const penalty = context?.modifiers?.healingPenalty ?? 0
      const player = context?.effectivePlayer
      const gained = player
        ? getActualHealGained({ ...player, maxHp: player.maxHp + effect.value }, effect.value, penalty)
        : Math.floor(effect.value / (1 + Math.max(0, penalty)))
      return `生命上限+${value}（同时恢复${numberText(gained)}）`
    }
    case 'goldBonus': return `战斗获得的金币增加${percent}`
    case 'heal': {
      if (context?.effectivePlayer) {
        return `立即恢复${getActualHealGained(context.effectivePlayer, effect.value, context.modifiers?.healingPenalty)}点生命`
      }
      return `立即恢复${value}点生命（受治疗减少影响，不超过上限）`
    }
    case 'bonusTurns': return `每回合多${value}步`
    case 'mergeCoefficient': return `合并获得的攻击增加${percent}`
    case 'spawnArmor': return `新方块也能增加防御（每点数值+${value}）`
    case 'startingPoints': return `每回合赠送${value}点方块；没空位会留到之后`
    case 'comboBonus': return `连续合并，每层多攒${value}点攻击；没合并就重算`
    case 'mergeArmor': return `合并时获得防御，数值为合并结果的${percent}`
    case 'armorCarry': return fraction === undefined
      ? '把部分合并防御留到下一回合；叠加后留下更多'
      : `把合并防御留到下一回合（当前留下${fraction}，含之前留下的防御）`
    case 'lifestealRating': return fraction === undefined
      ? '攻击造成伤害时回复生命；叠加后回复更多'
      : `攻击造成伤害时回复生命（卡牌当前回复伤害的${fraction}，受治疗减少影响）`
    case 'burstCoefficient': return `合并获得的攻击增加${percent}`
    case 'vulnerability': return `受到的敌人攻击伤害增加${percent}`
    case 'bleed': return `每层：回合结束流血，失去${value}点生命`
    case 'extraStrikeRating': return fraction === undefined
      ? '有机会再攻击一次；叠加后机会更大，每回合最多一次'
      : `有${fraction}机会再攻击一次（双方仍存活时，每回合最多一次）`
    case 'backlash': return `每层：触发追加攻击时，失去${value}点生命`
    case 'burn': return `每层：回合结束灼烧，失去${value}点生命`
    case 'healingPenalty': return fraction === undefined
      ? '回复的生命减少；叠加后减少更多'
      : `回复的生命减少${fraction}（实际回复向下取整）`
    case 'chargeLoss': return fraction === undefined
      ? '合并积攒的攻击减少；叠加后减少更多'
      : `后续合并积攒的攻击减少${fraction}（不影响已有攻击）`
    case 'soulRecoil': return `每层：滑动发生合并时，失去${value}点生命`
    case 'enemyRegen': return `每层：回合结束仍存活的敌人恢复${value}点生命（不超过上限）`
    case 'xpBonus': return `战斗获得的经验增加${percent}`
    case 'chargeStart': return `每回合开局自带${value}点蓄力`
    case 'spawnLuck': {
      if (total === undefined) return '新方块更容易出现高数值；叠加后更明显'
      const fourChance = percentText(0.1 + 0.9 * naturalFraction(total))
      return `新方块为 4 的概率达到${fourChance}`
    }
    case 'halveShield': return fraction === undefined
      ? '回合结束时方块有机会不减半；叠加后机会更大'
      : `回合结束时每个方块有${fraction}机会不减半`
    case 'comboGrace': return fraction === undefined
      ? '未合并的回合连锁会延续一部分；叠加后保留更多'
      : `未合并的回合连锁保留${fraction}（向下取整）`
    case 'executeRating': return fraction === undefined
      ? '攻击后敌人生命低于斩杀线时直接击杀；叠加后斩杀线提高'
      : `攻击后敌人生命低于最大生命的${fraction}时直接击杀`
    case 'critRating': return fraction === undefined
      ? '攻击有几率造成双倍伤害；叠加后几率提高'
      : `攻击有${fraction}几率造成双倍伤害`
    case 'savedStepsCharge': return `回合结束时每剩余 1 步，下回合开局获得${value}点蓄力`
    case 'greedRating': {
      if (total === undefined) return '战斗获得的金币翻倍；叠加后收益更高'
      return `战斗获得的金币增加${percentText(total)}`
    }
    case 'heavyLegs': {
      if (total === undefined) return `每回合行动步数减少${value}（至少保留 1 步）`
      return `每回合行动步数减少${numberText(total)}（至少保留 1 步）`
    }
    case 'armorErosion': return total === undefined
      ? '回合间保留的护甲会被侵蚀；叠加后侵蚀更多'
      : `侵蚀合计${numberText(total)}，直接抵扣护甲的传承比例`
    case 'enemyRage': return `每层：敌人攻击每回合成长 +${value}`
    case 'killAttackBonus': return `每击败一个敌人，攻击倍率 +${percent}，整局累积`
    case 'killHpBonus': return `每击败一个敌人，最大生命 +${value} 并等量回复`
    case 'smeltMastery': return `整局每累计合并 100 点方块数值，攻击倍率 +${percent}`
    case 'spendBlade': return `每累计花费 25 金币，攻击倍率 +${percent}`
    case 'veteranBlade': return `每进入一场战斗，攻击倍率 +${percent}`
    case 'lowHpFury': return `当前生命每降低 10%，攻击倍率 +${value}%（满血无加成）`
    case 'flatDamageReduction': return `每次承受攻击的伤害 −${value}，按持有数量累加`
    case 'guardedStance': return `交战结算时每剩余 1 点行动步数，本次承受的伤害额外 −${value}`
    case 'thornRating': return `受到攻击时有几率反弹伤害（${numberText(effect.value * 2)}＋本次减免量），几率随层数提升`
    case 'shieldGrind': return `整局每累计承受 30 点伤害，固定减伤 +${value}`
  }
}

export const displaySummary = summarizeEffect

/** 一项效果对应一行；红卡的代价与收益始终一起保留。 */
export function summarizeCard(def: Pick<UpgradeDef, 'effects'>, context?: DisplayContext): SummaryLine[] {
  return def.effects.map(effect => ({ text: summarizeEffect(effect, context), polarity: effect.polarity }))
}

export function summarizeConsumable(def: ConsumableDef): SummaryLine[] {
  if (def.cleanse) return [{ text: '移除已选紫卡一层；黑卡本局不可解除', polarity: 'positive' }]
  return def.effects.map(effect => ({
    polarity: effect.polarity,
    text: effect.type === 'bonusTurns' ? `多${numberText(effect.value)}步`
      : effect.type === 'mergeCoefficient' ? `后续合并获得的攻击增加${percentText(effect.value)}（不影响已有攻击）`
        : summarizeEffect(effect),
  }))
}

export function durationText(kind: UpgradeDef['kind'] | ConsumableDef['duration']): string {
  return kind === 'persistent' ? '本局持续' : kind === 'round' ? '本回合有效'
    : kind === 'battle' ? '本场战斗有效' : '立即生效'
}

export function cardClassHelp(cardClass: CardClass): string {
  return {
    white: '白卡：增强攻击、防御、生命等属性。治疗卡领取后立即使用。',
    blue: '蓝卡：增加步数、合并攻击或新方块带来的防御。',
    gold: '金卡：增加连锁、防御保留、吸血等能力。',
    red: '红卡：同时获得收益和代价，不能只选其中一项。',
    purple: '紫卡：带来负面效果，只能用净化药剂或特定奇遇移除一层。',
    black: '黑卡：带来负面效果，本局不可解除。',
  }[cardClass]
}
