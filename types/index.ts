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

export type UpgradeRarity = 'common' | 'rare' | 'epic';

// ---- 2048 Board ----

export interface Cell {
  value: number;       // 0 = empty
  id: number;          // unique ID for React key / animation tracking
  isNew: boolean;      // true if just spawned this turn
  isMerged: boolean;   // true if result of a merge this turn
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
}

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

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  rarity: UpgradeRarity;
  effect: UpgradeEffect;
  maxStacks: number;
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
  spawnReduction: number;
  enemyAtkDown: number;
  goldBoost: number;
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

export interface GameState {
  screen: Screen;
  theme: 'dark' | 'light';
  player: PlayerStats;
  upgrades: ActiveUpgrade[];
  route: RouteNode[];
  currentNodeId: string | null;
  battle: BattleState | null;
  rewardChoices: UpgradeDef[];
  rewardReason: 'start' | 'levelup';
  pendingLevels: number;
  shopUpgrades: (string | null)[];
  shopEquipment: (string | null)[];
  shopHeals: (string | null)[];
  shopRefreshCost: number;
  shopRemoveCost: number;
  shopRemoveUsed: boolean;
  stage: number;
  gameEvent: { id: string; title: string; icon: string; desc: string; choices: { label: string; tooltip?: string; effect: Record<string, any> }[] } | null;
  eventResult: { label: string; desc: string } | null;
  meta: MetaState;
  runSeed: number;
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
