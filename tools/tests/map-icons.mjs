import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

export async function run() {
  const root = path.resolve(import.meta.dirname, '../..')
  for (const type of ['start', 'battle', 'elite', 'event', 'rest', 'shop', 'boss']) {
    for (const variant of ['ink', 'gold']) {
      const file = path.join(root, 'static/map-icons', `${type}-${variant}.png`)
      const bytes = fs.readFileSync(file)
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'valid PNG')
      assert.equal(bytes.subarray(12, 16).toString(), 'IHDR')
      const width = bytes.readUInt32BE(16)
      const height = bytes.readUInt32BE(20)
      assert.ok(width >= 192 && width === height, 'high-resolution square icon')
      assert.equal(bytes[25], 6, 'RGBA transparency for parchment backgrounds')
      assert.ok(bytes.length > 500, 'rendered icon is not an empty placeholder')
    }
  }
  const component = fs.readFileSync(path.join(root, 'components/MapIcon.vue'), 'utf8')
  assert.ok(component.includes('/static/map-icons/'), 'local assets shared by every platform')
  assert.ok(!/https?:\/\//.test(component), 'no third-party icon requests')
  const route = fs.readFileSync(path.join(root, 'components/screens/RouteScreen.vue'), 'utf8')
  assert.equal((route.match(/<MapIcon\b/g) || []).length, 3, 'map, preview and legend use identical icons')
  assert.ok(!route.includes('ink-stroke'), 'legacy rectangle-built glyphs removed')
}
