export type EquipSlot = 'pants' | 'helmet' | 'armor' | 'gloves' | 'boots';

type SetData = {
  name: string; color: string;
  bonuses: { two: string; three: string; five: string };
  stats: Record<EquipSlot, Partial<Record<string, number>>>;
};

const SETS: Record<string, SetData> = {
  tempest:  { name: '暴风', color: '#3498db', bonuses: { two: '速度 +4', three: '攻击 +20%', five: '每回合多 2 步' },
    stats: { pants: { atk: 12 }, helmet: { spd: 1 }, armor: { atk: 8 }, gloves: { spd: 1 }, boots: { spd: 2 } } },
  fortress: { name: '磐石', color: '#95a5a6', bonuses: { two: '防御 +20%', three: '生命 +25%', five: '首击伤害减半且反弹 5 伤害' },
    stats: { pants: { def: 10 }, helmet: { hp: 12 }, armor: { def: 15 }, gloves: { def: 5 }, boots: { hp: 8 } } },
  shadow:   { name: '影步', color: '#9b59b6', bonuses: { two: '速度 +3', three: '攻击 +10%', five: '永远先手 + 10% 闪避' },
    stats: { pants: { spd: 2 }, helmet: { spd: 1 }, armor: { spd: 1 }, gloves: { spd: 2 }, boots: { spd: 3 } } },
  vampire:  { name: '噬血', color: '#c0392b', bonuses: { two: '攻击 +10%', three: '10% 吸血', five: '吸血翻倍 + 攻击 +25%' },
    stats: { pants: { atk: 15 }, helmet: { hp: 8 }, armor: { atk: 5 }, gloves: { atk: 5 }, boots: { hp: 5 } } },
  treasure: { name: '财宝', color: '#f1c40f', bonuses: { two: '金币 +25%', three: '经验 +30%', five: '掉落品质升一档' },
    stats: { pants: { gold: 10 }, helmet: { gold: 5 }, armor: { gold: 10 }, gloves: { gold: 5 }, boots: { gold: 10 } } },
  flame:    { name: '烈焰', color: '#e67e22', bonuses: { two: '攻击 +15%', three: '攻击 +25%', five: '攻击无视 40% 敌人防御' },
    stats: { pants: { atk: 18 }, helmet: { atk: 5 }, armor: { atk: 8 }, gloves: { atk: 8 }, boots: { atk: 5 } } },
  frost:    { name: '冰霜', color: '#1abc9c', bonuses: { two: '防御 +15%', three: '敌人速度 -4', five: '敌人攻击 -30%' },
    stats: { pants: { def: 8 }, helmet: { def: 5 }, armor: { def: 12 }, gloves: { def: 5 }, boots: { def: 5 } } },
  thunder:  { name: '雷霆', color: '#f39c12', bonuses: { two: '速度 +5', three: '攻击 +15%', five: '20% 概率敌人跳过反击' },
    stats: { pants: { spd: 2 }, helmet: { spd: 2 }, armor: { spd: 1 }, gloves: { spd: 2 }, boots: { spd: 3 } } },
  holy:     { name: '圣光', color: '#f5f5dc', bonuses: { two: '生命 +20%', three: '每回合恢复 8% HP', five: '恢复翻倍 + 防御 +20%' },
    stats: { pants: { hp: 10 }, helmet: { hp: 12 }, armor: { hp: 15 }, gloves: { hp: 5 }, boots: { hp: 8 } } },
  dark:     { name: '暗影', color: '#2c3e50', bonuses: { two: '攻击 +25%', three: '速度 +3', five: '攻击翻倍但防御减半' },
    stats: { pants: { atk: 20 }, helmet: { atk: 5 }, armor: { atk: 10 }, gloves: { atk: 8 }, boots: { atk: 5 } } },
  nature:   { name: '自然', color: '#27ae60', bonuses: { two: '全属性 +8%', three: '全属性 +12%', five: '全属性再 +20%' },
    stats: { pants: { atk: 5, def: 5 }, helmet: { hp: 5, spd: 1 }, armor: { def: 5, hp: 5 }, gloves: { atk: 5, spd: 1 }, boots: { spd: 1, hp: 5 } } },
  dragon:   { name: '龙裔', color: '#e74c3c', bonuses: { two: '生命 +30%', three: '攻击 +20%', five: 'HP+50% 攻击+30%' },
    stats: { pants: { atk: 10, hp: 5 }, helmet: { hp: 15 }, armor: { hp: 20 }, gloves: { atk: 8 }, boots: { hp: 10 } } },
  void:     { name: '虚空', color: '#8e44ad', bonuses: { two: '随机属性 +20%', three: '随机属性 +30%', five: '每回合随机一项属性翻倍' },
    stats: { pants: { atk: 10 }, helmet: { spd: 2 }, armor: { def: 10 }, gloves: { atk: 5 }, boots: { spd: 2 } } },
  time:     { name: '时光', color: '#16a085', bonuses: { two: '速度 +3', three: '步数 +2', five: '步数 +3 速度 +6' },
    stats: { pants: { spd: 2 }, helmet: { spd: 1 }, armor: { spd: 1 }, gloves: { spd: 2 }, boots: { spd: 3 } } },
  soul:     { name: '灵魂', color: '#dda0dd', bonuses: { two: '经验 +40%', three: '攻击 +10%', five: '经验翻倍 攻击+20%' },
    stats: { pants: { atk: 8 }, helmet: { xp: 15 }, armor: { xp: 15 }, gloves: { atk: 5 }, boots: { xp: 10 } } },
  warrior:  { name: '战士', color: '#c0392b', bonuses: { two: '攻击 +15% 防御 +10%', three: '生命 +20%', five: '攻击+25% 防御+25%' },
    stats: { pants: { atk: 12 }, helmet: { def: 5 }, armor: { atk: 5, def: 5 }, gloves: { atk: 8 }, boots: { def: 5 } } },
  hunter:   { name: '猎人', color: '#2ecc71', bonuses: { two: '速度 +4 金币 +20%', three: '先手攻击', five: '先手+金币+40%' },
    stats: { pants: { atk: 8 }, helmet: { spd: 2 }, armor: { gold: 10 }, gloves: { spd: 1 }, boots: { spd: 2 } } },
  sage:     { name: '贤者', color: '#3498db', bonuses: { two: '经验+30% 防御+10%', three: '每回合恢复 5% HP', five: '经验翻倍 防御+30%' },
    stats: { pants: { def: 8 }, helmet: { xp: 10 }, armor: { def: 10, hp: 5 }, gloves: { xp: 5 }, boots: { def: 5 } } },
  thief:    { name: '盗贼', color: '#7f8c8d', bonuses: { two: '金币+30% 速度+2', three: '15% 闪避', five: '闪避+金币+50%' },
    stats: { pants: { gold: 10 }, helmet: { spd: 1 }, armor: { gold: 10 }, gloves: { gold: 5 }, boots: { spd: 2 } } },
  king:     { name: '王者', color: '#f1c40f', bonuses: { two: '全属性 +10%', three: '全属性 +15%', five: '全属性+25% 双倍掉落' },
    stats: { pants: { atk: 10, def: 5 }, helmet: { hp: 8, spd: 1 }, armor: { atk: 5, def: 5, hp: 5 }, gloves: { atk: 5, spd: 1 }, boots: { spd: 2, hp: 5 } } },
};

export interface Equipment {
  id: string; name: string; slot: EquipSlot;
  rarity: 'common' | 'rare' | 'epic'; set: string;
  stats: Record<string, number>;
}

const RARITY_MULT: Record<string, number> = { common: 1, rare: 1.5, epic: 2.2 };
export const ALL_EQUIPMENT: Equipment[] = [];
const slotNames: Record<EquipSlot, string> = { pants: '护腿', helmet: '头盔', armor: '铠甲', gloves: '手套', boots: '战靴' };
const rarityOrder: ('common' | 'rare' | 'epic')[] = ['common', 'rare', 'epic'];

for (const [setId, setData] of Object.entries(SETS)) {
  for (const slot of Object.keys(setData.stats) as EquipSlot[]) {
    for (const rarity of rarityOrder) {
      const baseStats = setData.stats[slot];
      const mult = RARITY_MULT[rarity];
      const scaledStats: Record<string, number> = {};
      for (const [k, v] of Object.entries(baseStats)) scaledStats[k] = Math.round(v * mult);
      ALL_EQUIPMENT.push({ id: `eq_${setId}_${slot}_${rarity}`, name: `${setData.name}${slotNames[slot]}`, slot, rarity, set: setId, stats: scaledStats });
    }
  }
}

// ====== Non-set / unique equipment (no set bonuses) ======
const NO_SET_ITEMS: { name: string; slot: EquipSlot }[] = [
  { name: '幸运兔脚', slot: 'boots' },
  { name: '冒险者披风', slot: 'armor' },
  { name: '铁拳护手', slot: 'gloves' },
  { name: '佣兵头巾', slot: 'helmet' },
  { name: '旅人长裤', slot: 'pants' },
  { name: '巨人之力腰带', slot: 'gloves' },
  { name: '鹰眼目镜', slot: 'helmet' },
  { name: '轻羽靴', slot: 'boots' },
  { name: '韧皮护甲', slot: 'armor' },
  { name: '力量护腿', slot: 'pants' },
  { name: '贤者之帽', slot: 'helmet' },
  { name: '迅捷手套', slot: 'gloves' },
  { name: '踏云靴', slot: 'boots' },
  { name: '武僧绑带', slot: 'gloves' },
  { name: '潜行者兜帽', slot: 'helmet' },
];

for (const item of NO_SET_ITEMS) {
  for (const rarity of rarityOrder) {
    const id = `eq_noset_${item.name}_${item.slot}_${rarity}`.replace(/[^a-zA-Z0-9_]/g, '');
    ALL_EQUIPMENT.push({
      id,
      name: item.name,
      slot: item.slot,
      rarity,
      set: '',
      stats: {}, // generated dynamically in getEquipStats
    });
  }
}

export function getSetData(setId: string): SetData | undefined { return SETS[setId]; }

export function equipCost(eq: { rarity: string } | undefined): number {
  const costs: Record<string, number> = { common: 30, rare: 70, epic: 120 };
  return costs[eq?.rarity ?? 'common'] ?? 30;
}

export function computeEquipBonuses(equipped: Record<string, string | undefined>) {
  const setCounts: Record<string, number> = {};
  for (const compoundId of Object.values(equipped)) {
    if (!compoundId) continue;
    const baseId = compoundId.split(':')[0]
    const eq = ALL_EQUIPMENT.find(e => e.id === baseId);
    if (eq && eq.set) setCounts[eq.set] = (setCounts[eq.set] || 0) + 1;
  }
  const stats: Record<string, number> = { atk: 0, def: 0, spd: 0, hp: 0, gold: 0, xp: 0 };
  for (const compoundId of Object.values(equipped)) {
    if (!compoundId) continue;
    const scaled = getEquipStats(compoundId)
    for (const [k, v] of Object.entries(scaled)) stats[k] = (stats[k] || 0) + v;
  }
  const setEffects: any = { extraTurns: 0, lifesteal: 0, dodge: 0, skipChance: 0, fortify: false, firstStrike: false, doubleAtk: false, pierce: 0, doubleXp: false, doubleGold: false, regen: 0, reflect: 0, enemyAtkDown: 0, enemySpdDown: 0 };
  for (const [setId, count] of Object.entries(setCounts)) {
    const sd = SETS[setId]; if (!sd) continue;
    if (count >= 2) {
      if (setId === 'tempest') setEffects.extraTurns += 2;
      if (setId === 'fortress') { setEffects.fortify = true; setEffects.reflect = 5; }
      if (setId === 'shadow') { setEffects.firstStrike = true; if (count >= 5) setEffects.dodge = 0.1; }
      if (setId === 'vampire') { setEffects.lifesteal = count >= 5 ? 0.25 : 0.1; }
      if (setId === 'treasure') { if (count >= 5) setEffects.doubleGold = true; }
      if (setId === 'flame') { if (count >= 5) setEffects.pierce = 0.4; }
      if (setId === 'frost') { setEffects.enemyAtkDown = count >= 5 ? 0.3 : 0; setEffects.enemySpdDown = count >= 3 ? 4 : 0; }
      if (setId === 'thunder') { if (count >= 5) setEffects.skipChance = 0.2; }
      if (setId === 'holy') { setEffects.regen = count >= 5 ? 0.16 : count >= 3 ? 0.08 : 0; }
      if (setId === 'dark') { setEffects.doubleAtk = count >= 5; }
      if (setId === 'time') { setEffects.extraTurns += count >= 5 ? 3 : 2; }
      if (setId === 'soul') { if (count >= 5) setEffects.doubleXp = true; }
      if (setId === 'hunter') { if (count >= 3) setEffects.firstStrike = true; }
      if (setId === 'sage') { setEffects.regen = (setEffects.regen || 0) + (count >= 3 ? 0.05 : 0); if (count >= 5) setEffects.doubleXp = true; }
      if (setId === 'thief') { if (count >= 3) setEffects.dodge = (setEffects.dodge || 0) + 0.15; if (count >= 5) setEffects.doubleGold = true; }
      if (setId === 'king') { if (count >= 5) { setEffects.doubleGold = true; setEffects.doubleXp = true; } }
    }
  }
  return { stats, setEffects };
}

// ====== Level system ======
function equipLevel(compoundId: string): number {
  const parts = compoundId.split(':')
  return parseInt(parts[1] || '1') || 1
}
function equipBaseId(compoundId: string): string { return compoundId.split(':')[0] }
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function seededRand(seed: number) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000 }

const BONUS_POOL = [
  { key: 'atk', min: 10, max: 22 },
  { key: 'def', min: 8, max: 18 },
  { key: 'hp', min: 8, max: 20 },
  { key: 'spd', min: 1, max: 4 },
  { key: 'gold', min: 5, max: 12 },
  { key: 'xp', min: 5, max: 12 },
]

function genNoSetStats(baseId: string, compoundId: string, level: number, fluct: number): Record<string, number> {
  const seed = hashStr(compoundId)
  const rarity = baseId.includes('_epic') ? 'epic' : baseId.includes('_rare') ? 'rare' : 'common'
  const statCount = rarity === 'epic' ? 3 + Math.floor(seededRand(seed * 3 + 1) * 2)  // 3-4
    : rarity === 'rare' ? 2 + Math.floor(seededRand(seed * 5 + 1) * 2)   // 2-3
    : 1 + Math.floor(seededRand(seed * 7 + 1) * 2)                        // 1-2
  const lvlMult = 1 + (level - 1) * 0.12
  const result: Record<string, number> = {}
  const picked = new Set<number>()
  for (let i = 0; i < statCount; i++) {
    let idx: number, tries = 0
    do { idx = Math.floor(seededRand(seed + i * 137 + tries + 1) * BONUS_POOL.length); tries++ } while (picked.has(idx) && tries < 100)
    picked.add(idx)
    const p = BONUS_POOL[idx]
    const r = seededRand(seed + i * 251 + 2)
    const baseVal = p.min + Math.round(r * (p.max - p.min))
    const v = Math.round(baseVal * lvlMult * fluct)
    result[p.key] = (result[p.key] || 0) + v
  }
  return result
}

export function getEquipStats(compoundId: string): Record<string, number> {
  const baseId = equipBaseId(compoundId)
  const level = equipLevel(compoundId)
  const parts = compoundId.split(':')
  const fluct = Math.max(50, Math.min(150, parseInt(parts[2] || '100') || 100)) / 100
  const eq = ALL_EQUIPMENT.find(e => e.id === baseId)
  if (!eq) return {}
  // non-set: fully dynamic stats
  if (!eq.set) return genNoSetStats(baseId, compoundId, level, fluct)
  // set equipment: fixed stats with fluctuation
  const lvlMult = 1 + (level - 1) * 0.12
  const scaled: Record<string, number> = {}
  for (const [k, v] of Object.entries(eq.stats)) {
    const raw = Math.round(v * lvlMult * fluct)
    if (k === 'atk' || k === 'def' || k === 'hp') {
      scaled[k] = Math.max(1, Math.round(raw))
    } else if (k === 'gold' || k === 'xp') {
      scaled[k] = Math.round(v * lvlMult)
    } else {
      scaled[k] = raw
    }
  }
  return scaled
}

export function isNoSetItem(compoundId: string): boolean {
  const baseId = equipBaseId(compoundId)
  const eq = ALL_EQUIPMENT.find(e => e.id === baseId)
  return !eq || !eq.set
}

export function makeEquipId(baseId: string, level: number, fluct?: number): string {
  const f = fluct != null ? fluct : (70 + Math.floor(Math.random() * 61))
  return `${baseId}:${level}:${f}`
}

export type SortMode = 'quality' | 'level' | 'slot' | 'name' | 'set'

const QUALITY_ORDER: Record<string, number> = { epic: 3, rare: 2, common: 1 }
const SLOT_ORDER: Record<EquipSlot, number> = { helmet: 1, armor: 2, gloves: 3, pants: 4, boots: 5 }

export function sortInventory(ids: string[], mode: SortMode = 'quality'): string[] {
  return [...ids].sort((a, b) => {
    const eqA = ALL_EQUIPMENT.find(e => e.id === equipBaseId(a))
    const eqB = ALL_EQUIPMENT.find(e => e.id === equipBaseId(b))
    const nameA = eqA?.name || ''
    const nameB = eqB?.name || ''
    const qA = QUALITY_ORDER[eqA?.rarity || 'common'] || 0
    const qB = QUALITY_ORDER[eqB?.rarity || 'common'] || 0
    const sA = SLOT_ORDER[eqA?.slot || 'boots'] || 5
    const sB = SLOT_ORDER[eqB?.slot || 'boots'] || 5
    const lvA = equipLevel(a)
    const lvB = equipLevel(b)
    const setA = eqA?.set ? 0 : 1
    const setB = eqB?.set ? 0 : 1

    switch (mode) {
      case 'level':
        if (lvA !== lvB) return lvB - lvA
        if (qA !== qB) return qB - qA
        return sA - sB
      case 'slot':
        if (sA !== sB) return sA - sB
        if (qA !== qB) return qB - qA
        return lvB - lvA
      case 'name':
        if (nameA !== nameB) return nameA.localeCompare(nameB)
        if (qA !== qB) return qB - qA
        return lvB - lvA
      case 'set':
        if (setA !== setB) return setA - setB
        if (qA !== qB) return qB - qA
        if (sA !== sB) return sA - sB
        return lvB - lvA
      default: // quality
        if (qA !== qB) return qB - qA
        if (sA !== sB) return sA - sB
        return lvB - lvA
    }
  })
}
