import assert from 'node:assert/strict'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const { layoutRoute, routeConnection, routeSegment, ROUTE_MAP_WIDTH } = loadProject('./core/routeLayout')
  const node = (id, layer, position, nextIds = [], extra = {}) => ({ id, layer, position, nextIds, type: 'battle', enemy: null, accessible: false, completed: false, ...extra })
  const route = [
    node('a', 1, 0, ['c'], { completed: true }),
    node('b', 1, 1, ['d']),
    node('c', 2, 0, ['e'], { accessible: true }),
    node('d', 2, 1, ['f']),
    node('e', 3, 0, ['boss']),
    node('f', 3, 1, ['boss']),
    node('boss', 4, 0, [], { type: 'boss' }),
  ]
  const map = layoutRoute(route, 'a')
  assert.deepEqual(map, layoutRoute(route, 'a'), 'layout is deterministic')
  const sortNodes = nodes => [...nodes].sort((a, b) => a.node.id.localeCompare(b.node.id))
  assert.deepEqual(sortNodes(map.nodes), sortNodes(layoutRoute([...route].reverse(), 'a').nodes), 'input ordering does not move nodes')
  const placed = new Map(map.nodes.map(item => [item.node.id, item]))
  assert.equal(placed.get('a').state, 'current')
  assert.equal(placed.get('c').state, 'available')
  assert.equal(placed.get('e').state, 'future')
  assert.equal(placed.get('boss').state, 'future', 'a future merge remains reachable')
  assert.equal(placed.get('d').state, 'abandoned', 'unselected branch is not confused with future')
  assert.equal(map.edges.find(edge => edge.fromId === 'a').state, 'available')
  assert.equal(map.edges.find(edge => edge.fromId === 'd').state, 'abandoned')
  assert.ok(placed.get('a').y > placed.get('c').y, 'routes ascend')
  assert.ok(placed.get('a').x < placed.get('b').x, 'position ordering stays monotone')
  assert.equal(placed.get('boss').x, ROUTE_MAP_WIDTH / 2)
  for (const item of map.nodes) {
    assert.ok(item.x - item.radius >= 0 && item.x + item.radius <= ROUTE_MAP_WIDTH)
    assert.ok(item.y + item.radius < map.height)
    if (item.node.layer === 1) assert.ok(map.height - item.y >= 230, 'origin caption stays clear of first-layer labels')
  }
  for (const edge of map.edges) {
    const from = placed.get(edge.fromId)
    const to = placed.get(edge.toId)
    const first = edge.segments[0]
    const last = edge.segments.at(-1)
    assert.ok(Math.abs(Math.hypot(first.x - from.x, first.y - from.y) - from.radius) < 1e-8, 'line starts at source ring')
    assert.ok(Math.abs(Math.hypot(last.end.x - to.x, last.end.y - to.y) - to.radius) < 1e-8, 'line stops at destination ring')
    for (const [index, segment] of edge.segments.entries()) {
      const radians = segment.angle * Math.PI / 180
      assert.ok(Math.abs(segment.x + Math.cos(radians) * segment.length - segment.end.x) < 1e-8)
      assert.ok(Math.abs(segment.y + Math.sin(radians) * segment.length - segment.end.y) < 1e-8)
      if (index) assert.deepEqual({ x: segment.x, y: segment.y }, edge.segments[index - 1].end, 'bent segments meet')
    }
  }
  assert.equal(routeSegment({ x: 0, y: 0 }, { x: 3, y: 4 }).length, 5)
  assert.ok(routeConnection({ x: 0, y: 0 }, { x: 0, y: 0 }).every(segment => Number.isFinite(segment.length)))
  const visited = layoutRoute(route.map(item => item.id === 'c' ? { ...item, completed: true, accessible: false } : item), 'c')
  assert.equal(visited.nodes.find(item => item.node.id === 'a').state, 'visited')
  assert.equal(visited.edges.find(edge => edge.fromId === 'a').state, 'visited')
  const initial = layoutRoute(route.map(item => ({ ...item, completed: false, accessible: item.layer === 1 })))
  assert.ok(initial.nodes.every(item => item.state === 'available' || item.state === 'future'))
  const dense = layoutRoute(Array.from({ length: 4 }, (_, position) => node(`dense-${position}`, 1, position)))
  assert.ok(dense.nodes.every((item, index) => !index || item.x - dense.nodes[index - 1].x > 100), 'four nodes keep tactile target spacing')
  assert.deepEqual(layoutRoute([]).nodes, [])
}
