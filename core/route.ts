import type { RouteNode, NodeType } from '../types'
import { randomInt, createScopedRng } from './random'
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
      // 事件不需要敌人，也不应消耗选敌/强化的随机数。
      const noEnemy = type === 'shop' || type === 'rest' || type === 'event'
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

  // 连接使用独立作用域，不改变已有节点/敌人的抽签顺序。
  const signature = layers.flat().map(node => `${node.id}:${node.type}:${node.enemy?.id ?? ''}`).join('|')
  connectRouteLayers(layers, createScopedRng(stage, 'route-links', signature))

  return layers.flat();
}

export function connectRouteLayers(layers: RouteNode[][], rng: () => number): void {
  for (let li = 0; li < layers.length - 1; li++) {
    const current = layers[li]
    const next = layers[li + 1]
    const edges = new Set<string>()
    const center = (index: number, count: number) => (index + 0.5) / count
    const nearest = (index: number, count: number, otherCount: number) =>
      Math.min(otherCount - 1, Math.floor(center(index, count) * otherCount))
    const add = (from: number, to: number) => edges.add(`${from}:${to}`)

    // 双向补齐最近邻，保证每个节点既能到达，又能继续登顶。
    current.forEach((_, from) => add(from, nearest(from, current.length, next.length)))
    next.forEach((_, to) => add(nearest(to, next.length, current.length), to))

    for (let from = 0; from < current.length; from++) {
      const candidates = next.map((_, to) => to).filter(to =>
        !edges.has(`${from}:${to}`) && Math.abs(center(from, current.length) - center(to, next.length)) < 0.5,
      )
      for (const to of candidates) {
        const degree = [...edges].filter(edge => edge.startsWith(`${from}:`)).length
        if (degree >= 2) break
        const crosses = [...edges].some(edge => {
          const [otherFrom, otherTo] = edge.split(':').map(Number)
          return (from - otherFrom) * (to - otherTo) < 0
        })
        if (!crosses && rng() < 0.4) add(from, to)
      }
    }
    current.forEach((node, from) => {
      node.nextIds = next.filter((_, to) => edges.has(`${from}:${to}`)).map(node => node.id)
    })
  }
  for (const node of layers[layers.length - 1] ?? []) node.nextIds = []
}
