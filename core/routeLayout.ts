import type { RouteNode } from '../types'

// 纯展示坐标；固定 rpx 画幅随 uni-app 缩放，不读取或消耗玩法随机数。
export const ROUTE_MAP_WIDTH = 640
export const ROUTE_ROW_HEIGHT = 176
/** 图标＋类型文字＋状态文字的最大高度；相邻层至少留出这段距离，避免“刚完成/可前往”压到上层图标。 */
export const ROUTE_NODE_HEIGHT = 144
const ROUTE_JITTER = 7
const TOP_MARGIN = 144
const BOTTOM_MARGIN = 260

export interface RoutePoint { x: number; y: number }
export type RouteVisualState = 'current' | 'visited' | 'available' | 'future' | 'abandoned'
export interface LayoutNode extends RoutePoint {
  node: RouteNode
  radius: number
  state: RouteVisualState
}
export interface RouteSegment extends RoutePoint {
  length: number
  angle: number
  end: RoutePoint
}
export interface LayoutEdge {
  id: string
  fromId: string
  toId: string
  state: 'visited' | 'available' | 'future' | 'abandoned'
  segments: RouteSegment[]
}

function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index++) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619)
  }
  return result >>> 0
}

export function routeSegment(from: RoutePoint, to: RoutePoint): RouteSegment {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return { ...from, end: { ...to }, length: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) * 180 / Math.PI }
}

function inset(from: RoutePoint, toward: RoutePoint, radius: number): RoutePoint {
  const distance = Math.hypot(toward.x - from.x, toward.y - from.y)
  const fraction = Math.min(radius / Math.max(1, distance), 0.49)
  return { x: from.x + (toward.x - from.x) * fraction, y: from.y + (toward.y - from.y) * fraction }
}

// 三段折线留下轻微手绘弯折；端点始终落在各自图标的外圈。
export function routeConnection(from: RoutePoint, to: RoutePoint, fromRadius = 43, toRadius = 43, bend = 0): RouteSegment[] {
  const start = inset(from, to, fromRadius)
  const end = inset(to, from, toRadius)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const offsetX = -dy / distance * bend
  const offsetY = dx / distance * bend
  const first = { x: start.x + dx * 0.34 + offsetX, y: start.y + dy * 0.34 + offsetY }
  const second = { x: start.x + dx * 0.68 + offsetX * 0.65, y: start.y + dy * 0.68 + offsetY * 0.65 }
  const points = [start, first, second, end]
  return points.slice(0, -1).map((point, index) => routeSegment(point, points[index + 1]))
}

export function layoutRoute(route: RouteNode[], currentNodeId: string | null = null) {
  const byId = new Map(route.map(node => [node.id, node]))
  const reachable = new Set<string>()
  const queue = route.filter(node => node.accessible && !node.completed).map(node => node.id)
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index]
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const nextId of byId.get(id)?.nextIds ?? []) {
      if (byId.has(nextId) && !reachable.has(nextId)) queue.push(nextId)
    }
  }
  const groups = new Map<number, RouteNode[]>()
  for (const node of route) {
    const group = groups.get(node.layer) ?? []
    group.push(node)
    groups.set(node.layer, group)
  }
  const maxLayer = Math.max(1, ...groups.keys())
  const minLayer = Math.min(1, ...groups.keys())
  const nodes: LayoutNode[] = []
  for (const [layer, group] of groups) {
    const sorted = [...group].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    const spread = sorted.length === 2 ? 294 : 468
    for (const [index, node] of sorted.entries()) {
      const noise = hash(node.id)
      const x = sorted.length === 1 ? ROUTE_MAP_WIDTH / 2 : (ROUTE_MAP_WIDTH - spread) / 2 + spread * index / (sorted.length - 1) + (noise % 29 - 14)
      const y = TOP_MARGIN + (maxLayer - layer) * ROUTE_ROW_HEIGHT + (node.type === 'boss' ? 0 : Math.floor(noise / 29) % (ROUTE_JITTER * 2 + 1) - ROUTE_JITTER)
      const state: RouteVisualState = node.id === currentNodeId ? 'current' : node.completed ? 'visited' : node.accessible ? 'available' : reachable.has(node.id) ? 'future' : 'abandoned'
      nodes.push({ node, x, y, radius: node.type === 'boss' ? 68 : 43, state })
    }
  }
  const placedById = new Map(nodes.map(placed => [placed.node.id, placed]))
  const edges: LayoutEdge[] = []
  for (const from of nodes) {
    for (const nextId of from.node.nextIds) {
      const to = placedById.get(nextId)
      if (!to || to.node.layer <= from.node.layer) continue
      const state = from.node.completed && to.node.completed ? 'visited'
        : from.node.id === currentNodeId && to.state === 'available' ? 'available'
        : (from.state === 'available' || from.state === 'future') && to.state === 'future' ? 'future'
        : 'abandoned'
      edges.push({ id: `${from.node.id}--${nextId}`, fromId: from.node.id, toId: nextId, state, segments: routeConnection(from, to, from.radius, to.radius, hash(`${from.node.id}:${nextId}`) % 19 - 9) })
    }
  }
  return {
    nodes,
    edges,
    floors: [...groups.keys()].sort((a, b) => b - a).map(layer => ({ layer, y: TOP_MARGIN + (maxLayer - layer) * ROUTE_ROW_HEIGHT })),
    height: TOP_MARGIN + (maxLayer - minLayer) * ROUTE_ROW_HEIGHT + BOTTOM_MARGIN,
  }
}
