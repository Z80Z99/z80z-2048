import { RouteNode, NodeType } from '../types';
import { randomChoice, randomInt } from './random';
import { getEnemiesForLayer, getBossForStage, assignEnemyUpgrades, applyEnemyUpgradeStats } from './enemy';
import { generateProceduralEnemy, generateProceduralBoss } from './enemy';

export const LAYERS_PER_STAGE = 10;
const SHOP_LAYERS = [3, 6, 9];

function makeEnemy(stage: number, layer: number, isElite: boolean, rng: () => number) {
  const raw = stage <= 3
    ? getEnemiesForLayer(stage, layer, isElite, rng)
    : generateProceduralEnemy(stage, layer, isElite, rng);
  const upgrades = assignEnemyUpgrades(stage, rng);
  const boosted = applyEnemyUpgradeStats(upgrades, raw.attack, raw.defense, raw.speed, raw.hp);
  return { ...raw, enemyUpgrades: upgrades, attack: boosted.atk, defense: boosted.def, speed: boosted.spd, hp: boosted.hp, maxHp: boosted.hp };
}

export function generateRoute(rng: () => number, stage: number = 1): RouteNode[] {
  const layers: RouteNode[][] = [];
  let idCounter = 0;
  let eliteCount = 0;
  const totalLayers = LAYERS_PER_STAGE + 1;

  // Layer 1
  const firstLayerNodes: RouteNode[] = [];
  const firstCount = randomInt(rng, 2, 3);
  for (let i = 0; i < firstCount; i++) {
    firstLayerNodes.push({
      id: `s${stage}_n${idCounter++}`, type: 'battle', layer: 1, position: i,
      nextIds: [], enemy: makeEnemy(stage, 1, false, rng),
      completed: false, accessible: true,
    });
  }
  layers[0] = firstLayerNodes;

  // Layers 2-10
  for (let layer = 2; layer <= LAYERS_PER_STAGE; layer++) {
    const isShopLayer = SHOP_LAYERS.includes(layer);
    const nodeCount = isShopLayer ? 3 : randomInt(rng, 2, 4);
    const nodes: RouteNode[] = [];
    for (let i = 0; i < nodeCount; i++) {
      let type: NodeType;
      if (isShopLayer && i === 0) type = 'shop';
      else if (isShopLayer && i === 1) type = 'rest';
      else {
        const roll = rng();
        if (roll < 0.10 && eliteCount < 3) { type = 'elite'; eliteCount++; }
        else if (roll < 0.35) type = 'event'
        else if (roll < 0.48) type = 'rest'
        else type = 'battle';
      }
      const noEnemy = type === 'shop' || type === 'rest';
      nodes.push({
        id: `s${stage}_n${idCounter++}`, type, layer, position: i,
        nextIds: [], enemy: noEnemy ? null : makeEnemy(stage, layer, type === 'elite', rng),
        completed: false, accessible: false,
      });
    }
    layers[layer - 1] = nodes;
  }

  // Boss
  const bossLayer = totalLayers;
  const rawBoss = stage <= 3 ? getBossForStage(stage) : generateProceduralBoss(stage, rng);
  const bossUpgrades = assignEnemyUpgrades(stage, rng);
  const boostedBoss = applyEnemyUpgradeStats(bossUpgrades, rawBoss.attack, rawBoss.defense, rawBoss.speed, rawBoss.hp);
  const bossEnemy = { ...rawBoss, enemyUpgrades: bossUpgrades, attack: boostedBoss.atk, defense: boostedBoss.def, speed: boostedBoss.spd, hp: boostedBoss.hp, maxHp: boostedBoss.hp };
  layers[bossLayer - 1] = [{ id: `s${stage}_n${idCounter++}`, type: 'boss', layer: bossLayer, position: 0, nextIds: [], enemy: bossEnemy, completed: false, accessible: false }];

  // Connect all to next layer
  for (let li = 0; li < layers.length - 1; li++) {
    for (const node of layers[li]) node.nextIds = layers[li + 1].map(n => n.id);
  }

  return layers.flat();
}
