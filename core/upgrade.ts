import { UpgradeDef, UpgradeRarity } from '../types';
import { shuffleArray } from './random';

export const UPGRADE_POOL: UpgradeDef[] = [
  // ---- Common (8) ----
  { id: 'atk_up_1', name: '攻击强化', description: '攻击倍率 +20%', rarity: 'common', effect: { type: 'attack_multiplier', value: 0.2 }, maxStacks: 5 },
  { id: 'def_up_1', name: '防御强化', description: '防御倍率 +20%', rarity: 'common', effect: { type: 'defense_multiplier', value: 0.2 }, maxStacks: 5 },
  { id: 'heal_1', name: '急救包', description: '恢复 20 HP', rarity: 'common', effect: { type: 'heal', value: 20 }, maxStacks: 99 },
  { id: 'max_hp_1', name: '生命训练', description: '最大生命 +10（同时恢复 10 HP）', rarity: 'common', effect: { type: 'max_hp', value: 10 }, maxStacks: 5 },
  { id: 'spawn_red_1', name: '灵活身法', description: '生成方块的防御效果 +10%', rarity: 'common', effect: { type: 'spawn_reduction', value: 0.1 }, maxStacks: 5 },
  { id: 'enemy_atk_1', name: '弱点看破', description: '敌人攻击力 -1', rarity: 'common', effect: { type: 'enemy_atk_down', value: 1 }, maxStacks: 5 },
  { id: 'gold_1', name: '淘金者', description: '战斗获得金币 +15%', rarity: 'common', effect: { type: 'gold_boost', value: 0.15 }, maxStacks: 5 },
  { id: 'max_hp_3', name: '生命强化', description: '最大生命 +20（同时恢复 20 HP）', rarity: 'common', effect: { type: 'max_hp', value: 20 }, maxStacks: 4 },

  // ---- Rare (10) ----
  { id: 'atk_up_2', name: '强力攻击', description: '攻击倍率 +35%', rarity: 'rare', effect: { type: 'attack_multiplier', value: 0.35 }, maxStacks: 3 },
  { id: 'def_up_2', name: '铜墙铁壁', description: '防御倍率 +35%', rarity: 'rare', effect: { type: 'defense_multiplier', value: 0.35 }, maxStacks: 3 },
  { id: 'bonus_turn_1', name: '时间延长', description: '每回合步数 +3', rarity: 'rare', effect: { type: 'bonus_turns', value: 3 }, maxStacks: 3 },
  { id: 'heal_2', name: '大急救包', description: '恢复 40 HP', rarity: 'rare', effect: { type: 'heal', value: 40 }, maxStacks: 99 },
  { id: 'max_hp_2', name: '顽强生命', description: '最大生命 +30（同时恢复 30 HP）', rarity: 'rare', effect: { type: 'max_hp', value: 30 }, maxStacks: 3 },
  { id: 'start_tile_1', name: '开局优势', description: '每回合开始时棋盘上多一个 8', rarity: 'rare', effect: { type: 'starting_tile', value: 8 }, maxStacks: 3 },
  { id: 'spawn_red_2_5', name: '灵巧闪避', description: '生成方块的防御效果 +18%', rarity: 'rare', effect: { type: 'spawn_reduction', value: 0.18 }, maxStacks: 3 },
  { id: 'enemy_atk_2', name: '战术压制', description: '敌人攻击力 -2', rarity: 'rare', effect: { type: 'enemy_atk_down', value: 2 }, maxStacks: 3 },
  { id: 'gold_2', name: '黄金猎人', description: '战斗获得金币 +30%', rarity: 'rare', effect: { type: 'gold_boost', value: 0.3 }, maxStacks: 3 },
  { id: 'bonus_turn_0_5', name: '快速思考', description: '每回合步数 +2', rarity: 'rare', effect: { type: 'bonus_turns', value: 2 }, maxStacks: 4 },

  // ---- Epic (8) ----
  { id: 'atk_up_3', name: '毁灭之力', description: '攻击倍率 +50%', rarity: 'epic', effect: { type: 'attack_multiplier', value: 0.5 }, maxStacks: 2 },
  { id: 'def_up_3', name: '不朽之盾', description: '防御倍率 +50%', rarity: 'epic', effect: { type: 'defense_multiplier', value: 0.5 }, maxStacks: 2 },
  { id: 'bonus_turn_2', name: '时停', description: '每回合步数 +5', rarity: 'epic', effect: { type: 'bonus_turns', value: 5 }, maxStacks: 2 },
  { id: 'start_tile_2', name: '天命开局', description: '每回合开始时棋盘上多一个 32', rarity: 'epic', effect: { type: 'starting_tile', value: 32 }, maxStacks: 1 },
  { id: 'spawn_red_2', name: '幻影步法', description: '生成方块的防御效果 +25%', rarity: 'epic', effect: { type: 'spawn_reduction', value: 0.25 }, maxStacks: 2 },
  { id: 'enemy_atk_3', name: '破军之势', description: '敌人攻击力 -3', rarity: 'epic', effect: { type: 'enemy_atk_down', value: 3 }, maxStacks: 2 },
  { id: 'gold_3', name: '黄金律法', description: '战斗获得金币 +50%', rarity: 'epic', effect: { type: 'gold_boost', value: 0.5 }, maxStacks: 2 },
  { id: 'max_hp_4', name: '不灭之躯', description: '最大生命 +50（同时恢复 50 HP）', rarity: 'epic', effect: { type: 'max_hp', value: 50 }, maxStacks: 2 },
];

const rarityWeights: Record<UpgradeRarity, number> = {
  common: 60,
  rare: 30,
  epic: 10,
};

function weightedRarity(rng: () => number): UpgradeRarity {
  const roll = rng() * 100;
  if (roll < rarityWeights.epic) return 'epic';
  if (roll < rarityWeights.epic + rarityWeights.rare) return 'rare';
  return 'common';
}

export function pickUpgrades(
  rng: () => number,
  activeUpgradeIds: string[],
  activeCounts: Record<string, number>,
  count: number = 3,
  excludeHeal: boolean = false,
  hpRatio: number = 1,
  minRarity?: UpgradeRarity,
): UpgradeDef[] {
  // If player already owns any max_hp upgrade, override heal exclusion
  const hasMaxHpUpgrade = activeUpgradeIds.some(id =>
    UPGRADE_POOL.find(u => u.id === id && u.effect.type === 'max_hp'),
  );
  const shouldExcludeHeal = excludeHeal && !hasMaxHpUpgrade;

  // Filter: exclude upgrades at max stacks, and optionally heal
  const available = UPGRADE_POOL.filter(u => {
    const currentCount = activeCounts[u.id] ?? 0;
    if (currentCount >= u.maxStacks) return false;
    if (shouldExcludeHeal && u.effect.type === 'heal') return false;
    if (minRarity === 'rare' && u.rarity === 'common') return false;
    if (minRarity === 'epic' && u.rarity !== 'epic') return false;
    return true;
  });

  if (available.length === 0) return [];

  // Boost heal appearance when HP is low (< 50%): force first pick to be heal
  const healAvailable = available.find(u => u.effect.type === 'heal');
  const forceHeal = hpRatio < 0.5 && healAvailable && !excludeHeal;

  const shuffled = shuffleArray(rng, available);
  const picked: UpgradeDef[] = [];
  const rarityCounts: Record<UpgradeRarity, number> = { common: 0, rare: 0, epic: 0 };

  // Force heal as first pick when low HP
  if (forceHeal && healAvailable) {
    picked.push(healAvailable);
    rarityCounts[healAvailable.rarity]++;
  }

  // Then pick remaining by rarity weighting
  while (picked.length < count) {
    const rarity = weightedRarity(rng);
    // Limit: max 2 epics, max 3 rares per reward screen
    if (rarity === 'epic' && rarityCounts.epic >= 2) continue;
    if (rarity === 'rare' && rarityCounts.rare >= 3) continue;

    const candidates = shuffled.filter(
      u => u.rarity === rarity && !picked.includes(u),
    );
    const candidate = candidates.length > 0 ? candidates[0] : null;

    if (candidate) {
      picked.push(candidate);
      rarityCounts[rarity]++;
    } else {
      // Fallback: pick any unpicked from shuffled
      const fallback = shuffled.find(u => !picked.includes(u));
      if (fallback) {
        picked.push(fallback);
        rarityCounts[fallback.rarity]++;
      } else {
        break; // no more available
      }
    }
  }

  return picked;
}

export function upgradeCost(def: { rarity: string } | undefined): number {
  const costs: Record<string, number> = { common: 20, rare: 50, epic: 80 };
  return costs[def?.rarity ?? 'common'] ?? 20;
}

export function rarityText(rarity: string): string {
  const texts: Record<string, string> = { common: '普通', rare: '稀有', epic: '史诗' };
  return texts[rarity] ?? '普通';
}

export function getMetaUpgrades() {
  return [
    { id: 'meta_hp_1', name: '生命训练 I', description: '初始最大生命 +10', cost: 10, tiers: 1 },
    { id: 'meta_hp_2', name: '生命训练 II', description: '初始最大生命 +10', cost: 30, tiers: 1 },
    { id: 'meta_atk_1', name: '攻击本能 I', description: '初始攻击倍率 +10%', cost: 15, tiers: 1 },
    { id: 'meta_atk_2', name: '攻击本能 II', description: '初始攻击倍率 +10%', cost: 50, tiers: 1 },
    { id: 'meta_start', name: '初始优势', description: '开局获得一次强化选择', cost: 40, tiers: 1 },
  ];
}
