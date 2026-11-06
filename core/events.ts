import { ALL_EQUIPMENT, equipmentById, formatEquipStats, makeEquipId } from './equipment'
import type { EventEffectMap } from '../types'

export interface EventChoice {
  label: string
  tooltip?: string
  effect: EventEffect
}

export interface EventEffect extends EventEffectMap {
  type: string
}

export interface EventChoiceContext {
  inventory?: string[]
  equipment?: Record<string, string | undefined>
  gold?: number
}

// 结算结果只含已掷出的数值；预览后应缓存此结果，确认时不要再次掷骰。
export type ResolvedEventEffect =
  | { type: 'none' }
  | { type: 'gold' | 'heal' | 'hp_reduce' | 'maxhp_down' | 'maxhp_up' | 'xp'; value: number }
  | { type: 'hp_reduce_pct' | 'maxhp_down_pct'; value: number; atk_mult: number; def_mult: number }
  | { type: 'heal_curse'; heal: number; curse_hp: number }
  | { type: 'gold_heal'; heal: number; gold: number }
  | { type: 'gold_xp'; gold: number; xp: number }
  | { type: 'drop_equip'; eqId: string; cost: number }
  | { type: 'reforge'; removeEqId: string; eqId: string; gold: number; cost: number }

export interface GameEvent {
  id: string
  title: string
  icon: string
  desc: string
  stageMin: number
  choices: EventChoice[]
}

type NumberRoll = number | { min: number; max: number }

function isNumberRoll(value: unknown): value is NumberRoll {
  if (typeof value === 'number') return Number.isFinite(value)
  if (!value || typeof value !== 'object') return false
  const range = value as { min: number; max: number }
  return Number.isSafeInteger(range.min) && Number.isSafeInteger(range.max) && range.min <= range.max
}

function rollNumber(value: NumberRoll, rng: () => number): number {
  return typeof value === 'number' ? value : value.min + Math.floor(rng() * (value.max - value.min + 1))
}

const EVENTS: GameEvent[] = [
  // ===== Stage 1+ =====
  {
    id: 'treasure_chest',
    title: '宝箱',
    icon: '📦',
    desc: '路边发现一个发光的宝箱，里面似乎有贵重物品。',
    stageMin: 1,
    choices: [
      { label: '打开宝箱', tooltip: '获得 10~25 金币，无消耗', effect: { type: 'gold', value: { min: 10, max: 25 } } },
      { label: '无视它', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'healing_fountain',
    title: '治愈之泉',
    icon: '⛲',
    desc: '微光泉水可以恢复伤势，但畅饮可能招来诅咒。旁边的旅人也愿意收购少量泉水。',
    stageMin: 1,
    choices: [
      { label: '畅饮泉水', tooltip: '先回复最大生命值（含装备）的 30%（不超过上限）；随后有 30% 概率使本局基础生命上限降低 10%（最低 10），当前生命不超过新的总上限', effect: { type: 'heal', value: 30, curse: 30, curse_hp: 10 } },
      { label: '轻抿一口', tooltip: '回复最大生命值（含装备）的 10%（不超过上限），无副作用', effect: { type: 'heal', value: 10 } },
      { label: '装瓶出售泉水', tooltip: '获得 15~25 金币，不回复生命', effect: { type: 'gold', value: { min: 15, max: 25 } } },
    ],
  },
  {
    id: 'dark_shrine',
    title: '暗影祭坛',
    icon: '🏛',
    desc: '一座古老祭坛散发着不祥的气息。献上生命之力，或许能获得力量作为回报。',
    stageMin: 1,
    choices: [
      { label: '献上 20% 当前生命', tooltip: '当前生命降低 20%（至少保留 1 点），本局攻击倍率 +8 个百分点', effect: { type: 'hp_reduce_pct', value: 20, atk_mult: 0.08 } },
      { label: '献上 15% 基础生命上限', tooltip: '本局基础生命上限降低 15%（最低 10），当前生命不超过新的总上限；本局防御倍率 +12 个百分点', effect: { type: 'maxhp_down_pct', value: 15, def_mult: 0.12 } },
      { label: '离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'fallen_warrior',
    title: '陨落战士',
    icon: '⚰',
    desc: '一具白骨躺在路边，遗落的护具仍能使用。他腰间有个鼓鼓的布袋。',
    stageMin: 1,
    choices: [
      { label: '拾取遗落装备', tooltip: '随机获得 1 件普通装备，无消耗', effect: { type: 'drop_equip', rarity: 'common' } },
      { label: '搜刮钱袋', tooltip: '获得 20~35 金币，无消耗', effect: { type: 'gold', value: { min: 20, max: 35 } } },
    ],
  },
  // ===== Stage 2+ =====
  {
    id: 'gambler',
    title: '赌徒的邀约',
    icon: '🎲',
    desc: '赌徒展示了两种赌法：「先付赌注，赢了拿装备，输了没有奖励。输赢都不退赌注，不接受赊账。」',
    stageMin: 2,
    choices: [
      { label: '赌一把（20 金币）', tooltip: '需有 20 金币，输赢均只支付一次；50% 获得 1 件稀有装备，50% 无奖励', effect: { type: 'gamble', cost: 20, win_chance: 50, win_rarity: 'rare' } },
      { label: '谨慎下注（5 金币）', tooltip: '需有 5 金币，输赢均只支付一次；70% 获得 1 件普通装备，30% 无奖励', effect: { type: 'gamble', cost: 5, win_chance: 70, win_rarity: 'common' } },
      { label: '绕道走', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'ancient_scroll',
    title: '远古卷轴',
    icon: '📜',
    desc: '一卷尘封的卷轴记载着古老的知识。你可以仔细研读、简略翻阅，或把它出售给附近的收藏者。',
    stageMin: 2,
    choices: [
      { label: '仔细研读', tooltip: '获得 30~50 经验，无消耗、无副作用', effect: { type: 'xp', value: { min: 30, max: 50 } } },
      { label: '简略翻阅', tooltip: '获得 15 经验，无消耗、无副作用', effect: { type: 'xp', value: 15 } },
      { label: '出售卷轴', tooltip: '获得 8~15 金币，不获得经验', effect: { type: 'gold', value: { min: 8, max: 15 } } },
    ],
  },
  {
    id: 'spike_trap',
    title: '看似平静的地面',
    icon: '⚠',
    desc: '地面上的石板排列得异常整齐，空气中有淡淡的血腥味。你停下脚步，意识到它可能是个陷阱。',
    stageMin: 2,
    choices: [
      { label: '小心绕行', tooltip: '安全通过，无消耗、无奖励', effect: { type: 'none' } },
      { label: '试着拆除', tooltip: '50% 获得 15~30 金币；50% 损失 15 点生命（至少保留 1 点）', effect: { type: 'disarm', gold_win: { min: 15, max: 30 }, hp_lose: 15 } },
      { label: '冲刺过去', tooltip: '70% 安全通过，无消耗；30% 损失 25 点生命（至少保留 1 点）', effect: { type: 'sprint', safe: 70, hp_dmg: 25 } },
    ],
  },
  // ===== Stage 3+ =====
  {
    id: 'mysterious_box',
    title: '神秘黑匣',
    icon: '🎁',
    desc: '黑匣刻着古老封印，里面似乎藏着装备。匣子夹层里和周围的地面上散落着金币。',
    stageMin: 3,
    choices: [
      { label: '打破封印', tooltip: '随机获得 1 件稀有装备，无消耗', effect: { type: 'drop_equip', rarity: 'rare' } },
      { label: '搜寻夹层', tooltip: '获得 20~40 金币，无消耗', effect: { type: 'gold', value: { min: 20, max: 40 } } },
      { label: '只拾取地面金币', tooltip: '获得 5~10 金币，无消耗', effect: { type: 'gold', value: { min: 5, max: 10 } } },
    ],
  },
  {
    id: 'dying_merchant',
    title: '垂死商人',
    icon: '🧳',
    desc: '一个受伤商人倒在路边，身旁散落着行囊与旅行手记：「帮我包扎，余下的药可以替你疗伤，再给你一点金币作为谢礼。」',
    stageMin: 3,
    choices: [
      { label: '协助包扎并分享药剂', tooltip: '自己回复最大生命值（含装备）的 10%（不超过上限），并获得 5~10 金币；无消耗', effect: { type: 'heal_mixed', heal: 10, cost: 0, bonus_gold: { min: 5, max: 10 } } },
      { label: '拿走行囊与手记', tooltip: '获得 30~50 金币和 15~25 经验，没有其他效果', effect: { type: 'gold_xp', gold: { min: 30, max: 50 }, xp: { min: 15, max: 25 } } },
      { label: '转身离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'ancient_anvil',
    title: '远古锻造台',
    icon: '🔨',
    desc: '温热的铁砧可以收取金币锻造史诗装备，也能回收未装备的普通装备，换给你金币和稀有装备。供台上还留着一些金币。',
    stageMin: 3,
    choices: [
      { label: '淬火（消耗 25 金币）', tooltip: '支付 25 金币，随机获得 1 件史诗装备；需有足够金币', effect: { type: 'drop_equip', rarity: 'epic', cost: 25 } },
      { label: '拆装置换（消耗 1 件普通装备）', tooltip: '消耗背包中首件未装备普通装备，获得 15~25 金币和 1 件随机稀有装备；不额外消耗金币', effect: { type: 'reforge', cost: 0, sell_price: { min: 15, max: 25 }, new_rarity: 'rare' } },
      { label: '拾取供台金币后离开', tooltip: '获得 5~15 金币，无消耗', effect: { type: 'gold', value: { min: 5, max: 15 } } },
    ],
  },
]

function isReforgeEligible(eqId: string, context: EventChoiceContext): boolean {
  return typeof eqId === 'string' && !!context.inventory?.includes(eqId)
    && !Object.values(context.equipment ?? {}).includes(eqId)
    && equipmentById(eqId)?.rarity === 'common'
}

// 现有存档没有取得时间；取背包中首件合格物品，不把排序后的顺序当作取得时间。
// 相同 ID 的多份装备若有一份穿戴中，保守地全部排除，避免误拆身上装备。
export function getReforgeEligibleItem(context: EventChoiceContext = {}): string | null {
  return context.inventory?.find(eqId => isReforgeEligible(eqId, context)) ?? null
}

const EFFECT_FIELDS: Record<string, string[]> = {
  none: [], gold: ['value'], heal: ['value'], hp_reduce: ['value'], maxhp_down: ['value'],
  maxhp_up: ['value'], xp: ['value'], hp_reduce_pct: ['value'], maxhp_down_pct: ['value'],
  heal_curse: ['heal', 'curse_hp'], gold_heal: ['heal', 'gold'], gold_xp: ['gold', 'xp'],
  heal_mixed: ['heal', 'bonus_gold'], disarm: ['gold_win', 'hp_lose'], sprint: ['hp_dmg'],
  gamble: [], drop_equip: [], reforge: [],
}

// 同时接受原始选项与缓存的结算结果。失败不掷骰、不扣款，由调用者显示原因。
export function getEventChoiceDisabledReason(effect: Record<string, any>, context: EventChoiceContext = {}): string | null {
  if (!effect || !Object.prototype.hasOwnProperty.call(EFFECT_FIELDS, effect.type)) return '事件效果不受支持'
  const fields = [...EFFECT_FIELDS[effect.type]]
  if (effect.type === 'reforge') fields.push(effect.eqId != null ? 'gold' : 'sell_price')
  for (const field of fields) {
    const value = effect[field]
    if (!isNumberRoll(value)) return `事件数值无效：${field}`
    const minimum = typeof value === 'number' ? value : value.min
    if (minimum < 0 && !(effect.type === 'gold' && field === 'value')) return `事件数值不能为负：${field}`
  }
  for (const field of ['safe', 'curse', 'curse_hp', 'win_chance', 'heal']) {
    if (effect[field] != null && (typeof effect[field] !== 'number' || !Number.isFinite(effect[field]) || effect[field] < 0 || effect[field] > 100)) {
      return `事件百分比无效：${field}`
    }
  }
  if (['heal', 'hp_reduce_pct', 'maxhp_down', 'maxhp_down_pct'].includes(effect.type)) {
    const maximum = typeof effect.value === 'number' ? effect.value : effect.value.max
    if (maximum > 100) return '事件生命百分比不能超过 100%'
  }
  if (effect.type === 'heal' && effect.curse > 0 && effect.curse_hp == null) return '缺少诅咒的生命上限损失数值'
  for (const field of ['atk_mult', 'def_mult']) {
    if (effect[field] != null && (typeof effect[field] !== 'number' || !Number.isFinite(effect[field]))) return `事件倍率无效：${field}`
  }
  const cost = effect.cost ?? 0
  if (!Number.isSafeInteger(cost) || cost < 0) return '事件金币消耗无效'
  if (cost > 0 && !['drop_equip', 'gamble', 'reforge'].includes(effect.type)) return '此事件效果不支持额外金币消耗'
  const goldMinimum = effect.type === 'gold' ? (typeof effect.value === 'number' ? effect.value : effect.value.min) : 0
  const requiredGold = Math.max(cost, -goldMinimum)
  // 不把预期奖励拿来抵押，也不在缺少玩家信息时默认允许欠债。
  if (requiredGold > 0 && (typeof context.gold !== 'number' || !Number.isFinite(context.gold) || context.gold < requiredGold)) {
    return `金币不足：需要 ${requiredGold} 金币`
  }
  if (effect.type === 'reforge') {
    const item = effect.removeEqId ?? getReforgeEligibleItem(context)
    if (!item || !isReforgeEligible(item, context)) return '需要 1 件背包中的未装备普通装备'
    if (effect.eqId != null && !effect.removeEqId) return '重铸结果缺少待消耗装备'
  }
  if (['drop_equip', 'gamble', 'reforge'].includes(effect.type)) {
    if (effect.eqId != null) {
      if (typeof effect.eqId !== 'string' || !equipmentById(effect.eqId)) return '事件奖励装备不存在'
    } else {
      const rarity = effect.type === 'gamble' ? (effect.win_rarity ?? 'rare')
        : effect.type === 'reforge' ? (effect.new_rarity ?? 'rare') : (effect.rarity ?? 'common')
      if (!ALL_EQUIPMENT.some(eq => eq.rarity === rarity)) return '此品质暂无可用的事件奖励装备'
    }
  }
  return null
}

function describeEquipment(eqId: string): string {
  const eq = typeof eqId === 'string' ? equipmentById(eqId) : undefined
  if (!eq) return `装备数据不可用（${eqId ?? '缺少 ID'}）`
  const level = Number.parseInt(eqId.split(':')[1] || '1', 10) || 1
  const rarityNames = { common: '普通', rare: '稀有', epic: '史诗' }
  const stats = formatEquipStats(eqId).join('，')
  return `${rarityNames[eq.rarity]} ${eq.name} Lv.${level}（${stats || '无属性加成'}）`
}

export function buildEventResult(eff: Record<string, any>): string {
  if (eff.type === 'none') return '安全离开。无消耗，也无奖励。'
  if (eff.type === 'gold') {
    if (eff.value > 0) return `获得 ${eff.value} 金币。`
    if (eff.value < 0) return `失去 ${-eff.value} 金币。`
    return '金币没有变化。'
  }
  if (eff.type === 'heal') return `回复最大生命值（含装备）的 ${eff.value}%（不超过上限）。`
  if (eff.type === 'heal_curse') return `先按诅咒前的生命总上限（含装备）回复 ${eff.heal}% 生命（不超过上限）；随后触发诅咒，本局基础生命上限降低 ${eff.curse_hp}%（最低 10），当前生命不超过新的总上限。`
  if (eff.type === 'hp_reduce') return `失去 ${eff.value} 点生命（至少保留 1 点）。`
  if (eff.type === 'maxhp_down') return `本局基础生命上限降低 ${eff.value}%（最低 10），当前生命不超过新的总上限。`
  if (eff.type === 'maxhp_up') return `本局基础生命上限提升 ${eff.value} 点。`
  if (eff.type === 'xp') return `获得 ${eff.value} 经验。`
  if (eff.type === 'gold_heal') return `回复最大生命值（含装备）的 ${eff.heal}%（不超过上限），并获得 ${eff.gold} 金币。`
  if (eff.type === 'gold_xp') return `获得 ${eff.gold} 金币和 ${eff.xp} 经验。`
  if (eff.type === 'drop_equip') return `${eff.cost > 0 ? `支付 ${eff.cost} 金币；` : ''}获得 ${describeEquipment(eff.eqId)}。`
  if (eff.type === 'reforge') return `消耗 ${describeEquipment(eff.removeEqId)}；${eff.cost > 0 ? `支付 ${eff.cost} 金币；` : ''}获得 ${eff.gold} 金币和 ${describeEquipment(eff.eqId)}。`
  if (eff.type === 'hp_reduce_pct' || eff.type === 'maxhp_down_pct') {
    let desc = eff.type === 'hp_reduce_pct'
      ? `当前生命降低 ${eff.value}%（至少保留 1 点）`
      : `本局基础生命上限降低 ${eff.value}%（最低 10），当前生命不超过新的总上限`
    if (eff.atk_mult) desc += `；本局攻击倍率 +${Math.round(eff.atk_mult * 100)} 个百分点`
    if (eff.def_mult) desc += `；本局防御倍率 +${Math.round(eff.def_mult * 100)} 个百分点`
    return `${desc}。`
  }
  return `无法显示事件结果：不支持的效果「${eff.type}」。`
}

export function pickEvent(stage: number, rng: () => number): GameEvent {
  const pool = EVENTS.filter(e => e.stageMin <= stage)
  if (pool.length === 0) return EVENTS[0]
  const idx = Math.floor(rng() * pool.length)
  return { ...pool[idx] }
}

function rollEquipment(rarity: string, stage: number, rng: () => number): string {
  const pool = ALL_EQUIPMENT.filter(eq => eq.rarity === rarity)
  if (pool.length === 0) throw new Error('此品质暂无可用的事件奖励装备')
  const pick = pool[Math.floor(rng() * pool.length)]
  const level = (stage - 1) * 2 + 1 + Math.floor(rng() * 2)
  return makeEquipId(pick.id, level, undefined, rng)
}

export function resolveEventEffect(effect: EventEffect, stage: number, rng: () => number, context: EventChoiceContext = {}): ResolvedEventEffect {
  const reason = getEventChoiceDisabledReason(effect, context)
  if (reason) throw new Error(reason)
  if (!Number.isSafeInteger(stage) || stage < 1) throw new Error('事件阶段必须是正整数')
  const cost = effect.cost ?? 0
  switch (effect.type) {
    case 'none': return { type: 'none' }
    case 'gold':
    case 'hp_reduce':
    case 'maxhp_down':
    case 'maxhp_up':
    case 'xp':
      return { type: effect.type, value: rollNumber(effect.value, rng) }
    case 'hp_reduce_pct':
    case 'maxhp_down_pct':
      return { type: effect.type, value: rollNumber(effect.value, rng), atk_mult: effect.atk_mult ?? 0, def_mult: effect.def_mult ?? 0 }
    case 'heal': {
      const heal = rollNumber(effect.value, rng)
      if (effect.curse > 0 && rng() * 100 < effect.curse) return { type: 'heal_curse', heal, curse_hp: effect.curse_hp }
      return { type: 'heal', value: heal }
    }
    case 'heal_curse': return { type: 'heal_curse', heal: effect.heal, curse_hp: effect.curse_hp }
    case 'disarm': {
      const gold = rollNumber(effect.gold_win, rng)
      return rng() < 0.5 ? { type: 'gold', value: gold } : { type: 'hp_reduce', value: rollNumber(effect.hp_lose, rng) }
    }
    case 'sprint':
      return rng() * 100 < (effect.safe ?? 70) ? { type: 'none' } : { type: 'hp_reduce', value: rollNumber(effect.hp_dmg, rng) }
    case 'gamble':
      // 赌注只出现一次：赢时由装备结果的 cost 扣除，输时仅用负金币结果。
      return rng() * 100 < (effect.win_chance ?? 50)
        ? { type: 'drop_equip', eqId: rollEquipment(effect.win_rarity ?? 'rare', stage, rng), cost }
        : { type: 'gold', value: -cost }
    case 'heal_mixed': return { type: 'gold_heal', heal: effect.heal, gold: rollNumber(effect.bonus_gold, rng) }
    case 'gold_heal': return { type: 'gold_heal', heal: effect.heal, gold: rollNumber(effect.gold, rng) }
    case 'gold_xp': return { type: 'gold_xp', gold: rollNumber(effect.gold, rng), xp: rollNumber(effect.xp, rng) }
    case 'drop_equip':
      return { type: 'drop_equip', eqId: effect.eqId ?? rollEquipment(effect.rarity ?? 'common', stage, rng), cost }
    case 'reforge': {
      const removeEqId = effect.removeEqId ?? getReforgeEligibleItem(context)!
      const gold = rollNumber(effect.eqId != null ? effect.gold : effect.sell_price, rng)
      return { type: 'reforge', removeEqId, eqId: effect.eqId ?? rollEquipment(effect.new_rarity ?? 'rare', stage, rng), gold, cost }
    }
    default: throw new Error(`事件效果不受支持：${effect.type}`)
  }
}
