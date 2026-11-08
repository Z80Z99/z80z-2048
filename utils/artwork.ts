import type { EquipSlot } from '../core/equipment'
import type { CardClass } from '../types'

export const MONSTER_PORTRAIT_IDS = [
  'rat', 'slime', 'skeleton', 'bat', 'zombie', 'spider', 'slime_large',
  'ghoul', 'crawler', 'bone_archer', 'mud_golem', 'cave_troll',
  'orc', 'wraith', 'necromancer', 'boss_rock', 'boss_dragon', 'boss_final',
] as const

export const SET_EMBLEM_IDS = [
  'tempest', 'fortress', 'shadow', 'vampire', 'treasure', 'flame', 'frost',
  'thunder', 'holy', 'dark', 'nature', 'dragon', 'void', 'time', 'soul',
  'warrior', 'hunter', 'sage', 'thief', 'king',
] as const

const portraits: ReadonlySet<string> = new Set(MONSTER_PORTRAIT_IDS)
const emblems: ReadonlySet<string> = new Set(SET_EMBLEM_IDS)
const slots: ReadonlySet<string> = new Set(['helmet', 'armor', 'gloves', 'pants', 'boots'])

export const CARD_ART_ICONS = ['attack', 'defense', 'health', 'vitality', 'time', 'starting-tile', 'ward', 'weakness', 'wealth'] as const
const cardIcons: ReadonlySet<string> = new Set(CARD_ART_ICONS)
export const CARD_CLASS_SYMBOLS: Record<CardClass, string> = { white: '○', blue: '◆', gold: '★', red: '±', purple: '☒', black: '■' }

export function monsterPortrait(id: string): string | null {
  return portraits.has(id) ? `/static/enemies/${id}.png` : null
}

export function equipmentArtwork(slot?: EquipSlot | string): string {
  return `/static/items/${slot && slots.has(slot) ? slot : 'armor'}.png`
}

export function cardArtwork(icon?: string): string {
  return `/static/items/${icon && cardIcons.has(icon) ? icon : 'ward'}.png`
}

export function setEmblem(id?: string): string | null {
  return id && emblems.has(id) ? `/static/set-emblems/${id}.png` : null
}

export function stageArtwork(stage: number): string {
  return `/static/scenes/${stage === 1 ? 'dungeon' : stage === 2 ? 'abyss' : 'final'}.png`
}
