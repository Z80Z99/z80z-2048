import { GameState } from '../types'

export function createInitialState(): GameState {
  return {
    screen: 'title',
    theme: 'dark',
    player: {
      hp: 100, maxHp: 100,
      attackMultiplier: 1.0, defenseMultiplier: 1.0,
      flatAttack: 0, flatDefense: 0,
      bonusTurns: 0, baseMaxTurns: 6,
      spawnReduction: 0, enemyAtkDown: 0,
      goldBoost: 0, baseSpeed: 3,
      equipment: {}, inventory: [],
      gold: 0, xp: 0, level: 1, xpToNext: 25,
    },
    upgrades: [],
    route: [], currentNodeId: null, battle: null,
    rewardChoices: [], rewardReason: 'start', pendingLevels: 0,
    shopUpgrades: [null, null, null],
    shopEquipment: [null, null, null],
    shopHeals: [null],
    shopRefreshCost: 10, shopRemoveCost: 30, shopRemoveUsed: false,
    stage: 1,
    gameEvent: null,
    eventResult: null,
    meta: {
      totalGold: 0, totalRuns: 0, purchasedIds: [],
      highestDepth: 0, unlockedEnemies: [],
      enemyKills: {}, bestiaryBonusHp: 0, bestiaryBonusAtk: 0,
      bestiaryClaimed: [], enemyClaims: {}, globalClaimLevel: 0,
    },
    runSeed: 0,
  }
}
