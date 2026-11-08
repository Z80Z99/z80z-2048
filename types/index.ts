// ---- Enums / Union Types ----

export type Screen =
  | 'title'
  | 'route'
  | 'battle'
  | 'reward'
  | 'shop'
  | 'rest'
  | 'meta'
  | 'gameover'
  | 'boss_choice'
  | 'event';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type NodeType = 'start' | 'battle' | 'elite' | 'shop' | 'rest' | 'boss' | 'event';

export type EquipRarity = 'common' | 'rare' | 'epic';
// 仅用于旧装备接口互操作，卡牌不得使用该稀有度。
export type UpgradeRarity = EquipRarity;
export type CardClass = 'white' | 'blue' | 'gold' | 'red' | 'purple' | 'black';

// ---- 2048 Board ----

export interface Cell {
  value: number;       // 0 = empty
  id: number;          // stable ID for Vue key / animation tracking
  isNew: boolean;      // true if just spawned this turn
  isMerged: boolean;   // true if result of a merge this turn
  mergedFrom?: number[];
}

export interface SlideResult {
  grid: Cell[][];
  mergedSum: number;   // sum of values created by merging
  moved: boolean;
}

// ---- Enemy ----

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  tier: number;
  enemyUpgrades?: string[];
}

// ---- Battle ----

export interface RoundResult {
  playerDamage: number;
  enemyDamage: number;
  enemyHpAfter: number;
  overflowDamage: number;
  playerFirst: boolean;
  playerSpeed: number;
  enemySpeed: number;
  playerHpAfter?: number;
  healing?: number;
  reflectedDamage?: number;
  playerActed?: boolean;
  enemyActed?: boolean;
  avoidReason?: 'dodge' | 'skip' | 'defense' | 'kill' | null;
  fortifyUsed?: boolean;
  fortifyTriggered?: boolean;
  curseDamage?: number;
  extraDamage?: number;
  enemyHealing?: number;
  attackCount?: number;
}

export interface BattleState {
  grid: Cell[][];
  turnsUsed: number;
  maxTurns: number;
  totalAttack: number;      // accumulated merge values
  totalDefense: number;     // accumulated spawn values
  enemy: EnemyDef;
  enemyCurrentHp: number;
  phase: 'playing' | 'round_delay' | 'round_end' | 'finish_delay' | 'finished';
  result: BattleResult | null;
  round: number;
  lastRoundResult: RoundResult | null;
  savedSteps: number;
  equipEffects?: Partial<EquipSetEffects>;
  fortifyUsed?: boolean;
  totalTurns?: number;
  cardModifiers?: CardModifiers;
  roundModifiers?: Partial<CardModifiers>;
  battleModifiers?: Partial<CardModifiers>;
  startingPointsPending?: number;
  startingPointsGranted?: number;
  startingPointsPlaced?: number;
  comboStreak?: number;
  mergeCount?: number;
  mechanicArmor?: number;
  carryArmor?: number;
  lastMergedSum?: number;
  lastMoveDamage?: number;
  baseTurns?: number;
}

export type CombatAttribute = 'attack' | 'defense' | 'speed';

export interface EquipSetEffects {
  extraTurns: number;
  lifesteal: number;
  dodge: number;
  skipChance: number;
  fortify: boolean;
  firstStrike: boolean;
  doubleAtk: boolean;
  pierce: number;
  doubleXp: boolean;
  doubleGold: boolean;
  regen: number;
  reflect: number;
  enemyAtkDown: number;
  enemySpdDown: number;
  attackBonus: number;
  defenseBonus: number;
  hpBonus: number;
  speedBonus: number;
  speedPercent: number;
  goldBonus: number;
  xpBonus: number;
  halfDefense: boolean;
  dropRarityBoost: number;
  dropCount: number;
  randomBonus: number;
  randomDouble: boolean;
  randomStat?: CombatAttribute;
  doubleStat?: CombatAttribute;
}

export interface BattleResult {
  playerWon: boolean;
  playerDamageDealt: number;
  playerDamageTaken: number;
  goldEarned: number;
  totalRounds: number;
  xpEarned?: number;
  overflowDamage?: number;
  leveledUp?: boolean;
  savedSteps?: number;
  droppedEquipment?: string | null;
  droppedEquipmentIds?: string[];
}

// ---- Route Map ----

export interface RouteNode {
  id: string;
  type: NodeType;
  layer: number;
  position: number;
  nextIds: string[];
  enemy: EnemyDef | null;
  completed: boolean;
  accessible: boolean;
}

// ---- Upgrades ----

export type UpgradeEffect =
  | { type: 'attack_multiplier'; value: number }
  | { type: 'defense_multiplier'; value: number }
  | { type: 'bonus_turns'; value: number }
  | { type: 'starting_tile'; value: number }
  | { type: 'heal'; value: number }
  | { type: 'max_hp'; value: number }
  | { type: 'spawn_reduction'; value: number }
  | { type: 'enemy_atk_down'; value: number }
  | { type: 'gold_boost'; value: number };

export interface CardModifiers {
  attackBonus: number;
  defenseBonus: number;
  maxHpBonus: number;
  goldBonus: number;
  xpBonus: number;
  bonusTurns: number;
  mergeCoefficient: number;
  spawnArmor: number;
  startingPoints: number;
  comboBonus: number;
  mergeArmor: number;
  armorCarry: number;
  lifestealRating: number;
  burstCoefficient: number;
  vulnerability: number;
  bleed: number;
  extraStrikeRating: number;
  backlash: number;
  burn: number;
  healingPenalty: number;
  chargeLoss: number;
  soulRecoil: number;
  enemyRegen: number;
  comboGrace: number;
  executeRating: number;
  critRating: number;
  savedStepsCharge: number;
  chargeStart: number;
  spawnLuck: number;
  halveShield: number;
  greedRating: number;
  heavyLegs: number;
  armorErosion: number;
  enemyRage: number;
}

export interface CardEffect {
  type: keyof CardModifiers | 'heal';
  value: number;
  polarity: 'positive' | 'negative';
  scope: 'stat' | 'parameter' | 'mechanic';
  description: string;
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  cardClass: CardClass;
  kind: 'persistent' | 'instant';
  effects: CardEffect[];
  icon: string;
}

export interface ConsumableDef {
  id: string;
  name: string;
  description: string;
  cardClass: 'blue' | 'gold' | 'red';
  duration: 'round' | 'battle' | 'instant';
  icon: string;
  price: number;
  effects: CardEffect[];
  cleanse?: boolean;
}

export interface ActiveUpgrade {
  def: UpgradeDef;
  count: number;
}

// ---- Player / Run State ----

export interface PlayerStats {
  hp: number;
  maxHp: number;
  attackMultiplier: number;
  defenseMultiplier: number;
  flatAttack: number;
  flatDefense: number;
  bonusTurns: number;
  baseMaxTurns: number;
  spawnArmor: number;
  goldBoost: number;
  xpBoost: number;
  baseSpeed: number;
  equipment: { pants?: string; helmet?: string; armor?: string; gloves?: string; boots?: string };
  inventory: string[];
  gold: number;
  xp: number;
  level: number;
  xpToNext: number;
}

// ---- Meta / Persistence ----

export interface MetaState {
  totalGold: number;
  totalRuns: number;
  purchasedIds: string[];
  highestDepth: number;
  unlockedEnemies: string[];
  enemyKills: Record<string, number>;
  bestiaryBonusHp: number;
  bestiaryBonusAtk: number;
  bestiaryClaimed: number[];
  enemyClaims: Record<string, number>;
  globalClaimLevel: number;
}

export interface MetaUpgradeDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  tiers: number;
}

// ---- Root State ----

export interface RewardRequest {
  reason: 'start' | 'levelup' | 'elite' | 'boss';
  allowedClasses?: CardClass[];
}

export interface GameState {
  screen: Screen;
  theme: 'dark' | 'light';
  player: PlayerStats;
  upgrades: ActiveUpgrade[];
  route: RouteNode[];
  currentNodeId: string | null;
  battle: BattleState | null;
  rewardChoices: UpgradeDef[];
  rewardReason: RewardRequest['reason'];
  rewardQueue: RewardRequest[];
  rewardRollCount: number;
  pendingLevels: number;
  shopUpgrades: (string | null)[];
  shopEquipment: (string | null)[];
  shopHeals: (string | null)[];
  consumableCounts: Record<string, number>;
  shopConsumables: (string | null)[];
  restUsed: boolean;
  restResult: string | null;
  eventBlackConfirmed: boolean;
  shopRefreshCost: number;
  shopRefreshCount: number;
  shopRemoveCost: number;
  shopRemoveUsed: boolean;
  stage: number;
  gameEvent: { id: string; title: string; icon: string; desc: string; choices: { label: string; tooltip?: string; effect: Record<string, any> }[] } | null;
  eventResult: { label: string; desc: string; choiceIndex: number; effect: Record<string, any>; requiresBlackConfirmation?: boolean } | null;
  meta: MetaState;
  runSeed: number;
  runOutcome: 'victory' | 'defeat' | null;
  runShards: number;
  debugActionCount: number;
}

// ---- Events ----

// Payload fields used by event-choice effects (see core/events.ts).
// Loose by design: unknown payload keys remain accessible via the index signature,
// so generic effect handling still compiles without casts.
// NOTE: `value` is deliberately NOT listed here — store/gameStore.ts divides
// `eff.value` directly, so it must stay `any` through the index signature
// (a `number | { min; max }` union would break that arithmetic).
export interface EventEffectMap {
  gold?: number | { min: number; max: number };
  xp?: number | { min: number; max: number };
  heal?: number;
  bonus_gold?: number | { min: number; max: number };
  gold_win?: number | { min: number; max: number };
  sell_price?: number | { min: number; max: number };
  hp_lose?: number;
  hp_dmg?: number;
  safe?: number;
  safe_cost?: number;
  curse?: number;
  curse_hp?: number;
  cost?: number;
  win_rarity?: string;
  lose_gold?: number;
  rarity?: string;
  eqId?: string;
  atk_mult?: number;
  def_mult?: number;
  new_rarity?: string;
  [key: string]: any;
}
