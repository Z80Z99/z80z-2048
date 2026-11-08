import assert from 'node:assert/strict'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const { routeProgressText } = loadProject('./utils/routeProgress')
  assert.equal(routeProgressText(1, null, 3), '第 1 层有 3 条路可选')
  assert.equal(routeProgressText(3, 2, 2), '第 2 层已完成 · 第 3 层有 2 条路可选')
  assert.equal(routeProgressText(3, 2, 1), '第 2 层已完成 · 第 3 层有 1 条路可选')
  assert.equal(routeProgressText(null, 10, 0), '沿着足迹，继续远征')
  assert.doesNotMatch(routeProgressText(3, 2, 2), /当前位置/, 'finished and next floors are not both called current')
}
