import { EnemyDef } from '../types';

export interface EnemyEntry {
  def: EnemyDef;
  minLayer: number; // first layer this enemy can appear
}

// ====== Stage 1: 地牢入口 ======
const STAGE_1_NORMAL: EnemyEntry[] = [
  { def: { id: 'rat', name: '巨鼠', hp: 28, maxHp: 28, attack: 22, defense: 1, speed: 9, tier: 1 }, minLayer: 1 },
  { def: { id: 'slime', name: '史莱姆', hp: 38, maxHp: 38, attack: 16, defense: 4, speed: 4, tier: 1 }, minLayer: 1 },
  { def: { id: 'skeleton', name: '骷髅兵', hp: 44, maxHp: 44, attack: 14, defense: 6, speed: 3, tier: 1 }, minLayer: 2 },
  { def: { id: 'bat', name: '蝙蝠', hp: 24, maxHp: 24, attack: 19, defense: 0, speed: 11, tier: 1 }, minLayer: 2 },
  { def: { id: 'zombie', name: '僵尸', hp: 52, maxHp: 52, attack: 12, defense: 8, speed: 2, tier: 1 }, minLayer: 4 },
  { def: { id: 'spider', name: '暗蛛', hp: 32, maxHp: 32, attack: 20, defense: 3, speed: 7, tier: 1 }, minLayer: 5 },
  { def: { id: 'slime_large', name: '大型史莱姆', hp: 55, maxHp: 55, attack: 15, defense: 5, speed: 3, tier: 1 }, minLayer: 6 },
  { def: { id: 'ghoul', name: '食尸鬼', hp: 40, maxHp: 40, attack: 20, defense: 3, speed: 6, tier: 1 }, minLayer: 3 },
  { def: { id: 'crawler', name: '地穴爬行者', hp: 35, maxHp: 35, attack: 16, defense: 4, speed: 8, tier: 1 }, minLayer: 4 },
  { def: { id: 'bone_archer', name: '骷髅弓箭手', hp: 30, maxHp: 30, attack: 22, defense: 2, speed: 6, tier: 1 }, minLayer: 5 },
  { def: { id: 'mud_golem', name: '泥魔像', hp: 60, maxHp: 60, attack: 10, defense: 9, speed: 2, tier: 1 }, minLayer: 6 },
  { def: { id: 'cave_troll', name: '洞穴巨魔', hp: 65, maxHp: 65, attack: 18, defense: 7, speed: 3, tier: 1 }, minLayer: 7 },
];

const STAGE_1_ELITE: EnemyEntry[] = [
  { def: { id: 'orc', name: '兽人战士', hp: 65, maxHp: 65, attack: 28, defense: 8, speed: 6, tier: 1 }, minLayer: 3 },
  { def: { id: 'wraith', name: '幽灵', hp: 42, maxHp: 42, attack: 32, defense: 2, speed: 13, tier: 1 }, minLayer: 5 },
  { def: { id: 'necromancer', name: '亡灵法师', hp: 38, maxHp: 38, attack: 30, defense: 5, speed: 8, tier: 1 }, minLayer: 4 },
];

const STAGE_1_BOSS: EnemyDef = { id: 'boss_rock', name: '岩石巨人', hp: 160, maxHp: 160, attack: 36, defense: 18, speed: 8, tier: 4 };

// ====== Stage 2: 深渊回廊 ======
const STAGE_2_NORMAL: EnemyEntry[] = [
  { def: { id: 'golem', name: '石魔像', hp: 70, maxHp: 70, attack: 22, defense: 14, speed: 3, tier: 2 }, minLayer: 1 },
  { def: { id: 'mage', name: '邪法师', hp: 50, maxHp: 50, attack: 30, defense: 8, speed: 8, tier: 2 }, minLayer: 1 },
  { def: { id: 'assassin', name: '暗影刺客', hp: 38, maxHp: 38, attack: 36, defense: 1, speed: 14, tier: 2 }, minLayer: 2 },
  { def: { id: 'specter', name: '幽魂', hp: 45, maxHp: 45, attack: 34, defense: 4, speed: 11, tier: 2 }, minLayer: 3 },
  { def: { id: 'fire_ele', name: '火元素', hp: 55, maxHp: 55, attack: 28, defense: 6, speed: 9, tier: 2 }, minLayer: 4 },
  { def: { id: 'cursed_knight', name: '咒缚骑士', hp: 78, maxHp: 78, attack: 26, defense: 12, speed: 5, tier: 2 }, minLayer: 5 },
  { def: { id: 'dark_mage', name: '暗法师', hp: 48, maxHp: 48, attack: 38, defense: 5, speed: 10, tier: 2 }, minLayer: 6 },
  { def: { id: 'abyss_worm', name: '深渊蠕虫', hp: 65, maxHp: 65, attack: 24, defense: 10, speed: 4, tier: 2 }, minLayer: 3 },
  { def: { id: 'shadow_beast', name: '暗影兽', hp: 50, maxHp: 50, attack: 34, defense: 4, speed: 10, tier: 2 }, minLayer: 4 },
  { def: { id: 'iron_golem', name: '铁魔像', hp: 85, maxHp: 85, attack: 20, defense: 15, speed: 2, tier: 2 }, minLayer: 5 },
  { def: { id: 'soul_eater', name: '噬魂者', hp: 42, maxHp: 42, attack: 38, defense: 3, speed: 12, tier: 2 }, minLayer: 6 },
  { def: { id: 'flame_wyrm', name: '烈焰幼龙', hp: 72, maxHp: 72, attack: 32, defense: 8, speed: 8, tier: 2 }, minLayer: 7 },
];

const STAGE_2_ELITE: EnemyEntry[] = [
  { def: { id: 'dragon_whelp', name: '幼龙', hp: 85, maxHp: 85, attack: 34, defense: 12, speed: 9, tier: 2 }, minLayer: 3 },
  { def: { id: 'lich', name: '巫妖', hp: 68, maxHp: 68, attack: 40, defense: 7, speed: 12, tier: 2 }, minLayer: 6 },
  { def: { id: 'plague_bringer', name: '瘟疫使者', hp: 55, maxHp: 55, attack: 36, defense: 6, speed: 11, tier: 2 }, minLayer: 5 },
];

const STAGE_2_BOSS: EnemyDef = { id: 'boss_dragon', name: '远古巨龙', hp: 200, maxHp: 200, attack: 50, defense: 22, speed: 14, tier: 4 };

// ====== Stage 3: 终焉之间 ======
const STAGE_3_NORMAL: EnemyEntry[] = [
  { def: { id: 'giant', name: '独眼巨人', hp: 100, maxHp: 100, attack: 30, defense: 18, speed: 5, tier: 3 }, minLayer: 1 },
  { def: { id: 'demon', name: '恶魔', hp: 75, maxHp: 75, attack: 42, defense: 9, speed: 12, tier: 3 }, minLayer: 1 },
  { def: { id: 'bone_knight', name: '骸骨骑士', hp: 88, maxHp: 88, attack: 36, defense: 14, speed: 7, tier: 3 }, minLayer: 2 },
  { def: { id: 'void_eye', name: '深渊之眼', hp: 60, maxHp: 60, attack: 44, defense: 6, speed: 13, tier: 3 }, minLayer: 3 },
  { def: { id: 'fire_lord', name: '炎魔', hp: 90, maxHp: 90, attack: 38, defense: 10, speed: 9, tier: 3 }, minLayer: 4 },
  { def: { id: 'fallen_angel', name: '堕天使', hp: 72, maxHp: 72, attack: 46, defense: 8, speed: 15, tier: 3 }, minLayer: 5 },
  { def: { id: 'chaos_beast', name: '混沌兽', hp: 110, maxHp: 110, attack: 34, defense: 16, speed: 6, tier: 3 }, minLayer: 6 },
  { def: { id: 'executioner', name: '处刑者', hp: 105, maxHp: 105, attack: 45, defense: 8, speed: 6, tier: 3 }, minLayer: 3 },
  { def: { id: 'mind_flayer', name: '夺心魔', hp: 68, maxHp: 68, attack: 42, defense: 6, speed: 14, tier: 3 }, minLayer: 5 },
  { def: { id: 'hell_knight', name: '地狱骑士', hp: 120, maxHp: 120, attack: 36, defense: 18, speed: 7, tier: 3 }, minLayer: 6 },
  { def: { id: 'void_lord', name: '虚空领主', hp: 95, maxHp: 95, attack: 48, defense: 10, speed: 12, tier: 3 }, minLayer: 7 },
  { def: { id: 'doom_bringer', name: '末日使者', hp: 130, maxHp: 130, attack: 40, defense: 14, speed: 8, tier: 3 }, minLayer: 7 },
];

const STAGE_3_ELITE: EnemyEntry[] = [
  { def: { id: 'hydra', name: '远古九头蛇', hp: 140, maxHp: 140, attack: 40, defense: 15, speed: 8, tier: 3 }, minLayer: 4 },
  { def: { id: 'death_angel', name: '死亡天使', hp: 85, maxHp: 85, attack: 48, defense: 10, speed: 14, tier: 3 }, minLayer: 7 },
  { def: { id: 'archdemon', name: '大恶魔', hp: 120, maxHp: 120, attack: 52, defense: 12, speed: 13, tier: 3 }, minLayer: 6 },
];

const STAGE_3_BOSS: EnemyDef = { id: 'boss_final', name: '终焉之主', hp: 260, maxHp: 260, attack: 56, defense: 26, speed: 16, tier: 4 };

// ====== Stage 4+: Endless procedural enemies ======
const ENDLESS_TEMPLATES: { name: string; hp: number; atk: number; def: number; spd: number }[] = [
  { name: '虚空行者', hp: 80, atk: 40, def: 12, spd: 10 },
  { name: '混沌魔', hp: 100, atk: 36, def: 16, spd: 8 },
  { name: '深渊领主', hp: 120, atk: 44, def: 14, spd: 12 },
  { name: '星界吞噬者', hp: 90, atk: 48, def: 8, spd: 15 },
  { name: '不朽守护者', hp: 150, atk: 30, def: 22, spd: 5 },
  { name: '暗影龙', hp: 110, atk: 42, def: 12, spd: 13 },
  { name: '破碎之魂', hp: 70, atk: 50, def: 6, spd: 16 },
  { name: '远古魔像', hp: 160, atk: 34, def: 20, spd: 4 },
  { name: '虚空龙', hp: 130, atk: 46, def: 14, spd: 11 },
  { name: '终焉使徒', hp: 100, atk: 44, def: 10, spd: 14 },
  { name: '时空裂隙', hp: 85, atk: 48, def: 10, spd: 13 },
  { name: '原初混沌', hp: 140, atk: 38, def: 18, spd: 6 },
  { name: '虚无之影', hp: 75, atk: 52, def: 4, spd: 17 },
  { name: '永恒守卫', hp: 170, atk: 32, def: 24, spd: 3 },
  { name: '星界审判官', hp: 115, atk: 46, def: 13, spd: 12 },
];

const ENDLESS_ELITE_TEMPLATES: { name: string; hp: number; atk: number; def: number; spd: number }[] = [
  { name: '时空扭曲者', hp: 160, atk: 52, def: 18, spd: 13 },
  { name: '灭世者', hp: 180, atk: 56, def: 20, spd: 14 },
  { name: '维度裂缝', hp: 140, atk: 60, def: 14, spd: 16 },
  { name: '星界守护者', hp: 200, atk: 48, def: 24, spd: 10 },
  { name: '虚空之喉', hp: 150, atk: 64, def: 12, spd: 17 },
];

const ENDLESS_BOSS_NAMES = ['虚空之主', '混沌之源', '终焉化身', '灭世神', '原初之暗', '星界审判长', '虚无之王', '万象归零'];

// ====== Public API ======

function getEnemiesForLayer(stage: number, layer: number, elite: boolean, rng: () => number): EnemyDef {
  let pool: EnemyEntry[];

  if (stage === 1) {
    pool = elite ? STAGE_1_ELITE : STAGE_1_NORMAL;
  } else if (stage === 2) {
    pool = elite ? STAGE_2_ELITE : STAGE_2_NORMAL;
  } else {
    pool = elite ? STAGE_3_ELITE : STAGE_3_NORMAL;
  }

  // Filter by minLayer
  const candidates = pool.filter(e => e.minLayer <= layer);
  // Pick one - prefer later minLayer for deeper layers
  if (candidates.length === 0) return pool[0].def;
  // Weight higher minLayer more for deeper layers
  const weights = candidates.map(e => 1 + Math.max(0, layer - e.minLayer));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i].def;
  }
  return candidates[candidates.length - 1].def;
}

function getBossForStage(stage: number): EnemyDef {
  if (stage === 1) return { ...STAGE_1_BOSS };
  if (stage === 2) return { ...STAGE_2_BOSS };
  return { ...STAGE_3_BOSS };
}

// Legacy exports for backward compat
export const ENEMIES: EnemyDef[] = [
  ...STAGE_1_NORMAL.map(e => e.def),
  ...STAGE_1_ELITE.map(e => e.def), STAGE_1_BOSS,
  ...STAGE_2_NORMAL.map(e => e.def),
  ...STAGE_2_ELITE.map(e => e.def), STAGE_2_BOSS,
  ...STAGE_3_NORMAL.map(e => e.def),
  ...STAGE_3_ELITE.map(e => e.def), STAGE_3_BOSS,
];

export function generateProceduralEnemy(stage: number, layer: number, elite: boolean, rng: () => number): EnemyDef {
  const scale = 1 + (stage - 3) * 0.35 + layer * 0.02;
  const templates = elite ? ENDLESS_ELITE_TEMPLATES : ENDLESS_TEMPLATES;
  const tmpl = templates[Math.floor(rng() * templates.length)];
  const id = `endless_${stage}_${layer}_${Math.floor(rng() * 9999)}`;
  return {
    id, name: tmpl.name, tier: 4,
    hp: Math.floor(tmpl.hp * scale),
    maxHp: Math.floor(tmpl.hp * scale),
    attack: Math.floor(tmpl.atk * scale),
    defense: Math.floor(tmpl.def * scale),
    speed: Math.floor(tmpl.spd * scale),
  };
}

export function generateProceduralBoss(stage: number, rng: () => number): EnemyDef {
  const name = ENDLESS_BOSS_NAMES[(stage - 4) % ENDLESS_BOSS_NAMES.length];
  const scale = 1 + (stage - 3) * 0.4;
  return {
    id: `boss_endless_${stage}`,
    name: `${name} Lv.${stage}`,
    tier: 4,
    hp: Math.floor(250 * scale),
    maxHp: Math.floor(250 * scale),
    attack: Math.floor(60 * scale),
    defense: Math.floor(24 * scale),
    speed: Math.floor(16 * scale),
  };
}

export { getEnemiesForLayer, getBossForStage };

export const ROUND_ATK_BONUS = 3;
export const ROUND_DEF_BONUS = 3;
export const ROUND_SPD_BONUS = 1;

// ====== Enemy Upgrade Cards ======
// Enemies inherit player upgrade cards, 1 per stage starting from S2
import { UPGRADE_POOL } from './upgrade';

export function assignEnemyUpgrades(stage: number, rng: () => number): string[] {
  const count = stage <= 1 ? 0 : stage - 1;
  if (count <= 0) return [];
  const pool = UPGRADE_POOL.filter(u =>
    u.effect.type !== 'heal' && u.effect.type !== 'bonus_turns' && u.effect.type !== 'starting_tile' && u.effect.type !== 'gold_boost' && u.effect.type !== 'enemy_atk_down'
  );
  const result: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return result;
}

// Apply enemy upgrade effects to stats
export function applyEnemyUpgradeStats(upgradeIds: string[], atk: number, def: number, spd: number, hp: number): { atk: number; def: number; spd: number; hp: number } {
  let a = atk, d = def, s = spd, h = hp;
  for (const id of upgradeIds) {
    const u = UPGRADE_POOL.find(x => x.id === id);
    if (!u) continue;
    switch (u.effect.type) {
      case 'attack_multiplier': a = Math.floor(a * (1 + u.effect.value)); break;
      case 'defense_multiplier': d = Math.floor(d * (1 + u.effect.value)); break;
      case 'spawn_reduction': d = Math.floor(d * (1 + u.effect.value)); break;
      case 'max_hp': h = Math.floor(h * (1 + u.effect.value / 100)); break;
      case 'enemy_atk_down': a = Math.floor(a * (1 - u.effect.value)); break;
      case 'gold_boost': break; // just means more gold on death
    }
  }
  return { atk: a, def: d, spd: s, hp: h };
}
