import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const { generateRoute } = loadProject('./core/route')
  const { createRng } = loadProject('./core/random')
  let forks = 0
  let restricted = 0
  for (const stage of [1, 2, 3, 4, 10]) for (let seed = 1; seed <= 100; seed++) {
    const route = generateRoute(createRng(seed), stage)
    assert.deepEqual(route, generateRoute(createRng(seed), stage))
    const byId = new Map(route.map(node => [node.id, node]))
    const reachable = new Set(route.filter(node => node.layer === 1).map(node => node.id))
    for (const node of route) {
      assert.ok(reachable.has(node.id), 'every generated node reachable from entrance')
      const nextLayer = route.filter(next => next.layer === node.layer + 1)
      assert.equal(new Set(node.nextIds).size, node.nextIds.length)
      assert.ok(nextLayer.length ? node.nextIds.length >= 1 && node.nextIds.length <= 2 : node.nextIds.length === 0)
      if (node.nextIds.length === 2) forks++
      if (node.nextIds.length < nextLayer.length) restricted++
      for (const nextId of node.nextIds) {
        const next = byId.get(nextId)
        assert.equal(next.layer, node.layer + 1)
        reachable.add(nextId)
        for (const other of route.filter(other => other.layer === node.layer)) for (const otherNextId of other.nextIds) {
          assert.ok((node.position - other.position) * (next.position - byId.get(otherNextId).position) >= 0, 'route edges do not cross')
        }
      }
    }
    assert.equal(route.filter(node => node.type === 'boss').length, 1)
  }
  assert.ok(forks > 0 && restricted > 0, 'real branching paths, not all-to-all edges')

  const require = createRequire(import.meta.url)
  const { createPinia, setActivePinia } = require('pinia')
  setActivePinia(createPinia())
  const { useGameStore } = loadProject('./store/gameStore')
  const store = useGameStore()
  store.START_RUN(42)
  const first = store.route.find(node => node.accessible && node.nextIds.length < store.route.filter(next => next.layer === node.layer + 1).length)
  assert.ok(first)
  store.SELECT_NODE(first.id)
  const allowed = store.route.filter(node => node.accessible).map(node => node.id)
  assert.deepEqual(allowed, first.nextIds)
  const forbidden = store.route.find(node => node.layer === first.layer + 1 && !node.accessible)
  store.battle = null
  store.screen = 'route'
  const previous = store.currentNodeId
  store.SELECT_NODE(forbidden.id)
  assert.equal(store.currentNodeId, previous, 'cannot select an unconnected next-layer node')
}
