// 页面滚动：pages.json 关闭了原生页面滚动（保证棋盘滑动），其余屏幕必须能自己滚动，
// 且手势不能冒泡到框架挂在 document 上的滚动拦截——否则手机上手指拖不动。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

export async function run() {
  const root = path.resolve(import.meta.dirname, '../..')
  const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')
  const pages = JSON.parse(read('pages.json'))
  assert.equal(pages.pages[0].style.disableScroll, true, 'native page scrolling stays disabled so board swipes never scroll the page')

  const screenRule = read('App.vue').match(/\.screen \{[^}]*\}/)?.[0] ?? ''
  assert.match(screenRule, /height: var\(--viewport-height\)/, 'screens are exactly one viewport tall')
  assert.match(screenRule, /overflow-y: auto/, 'screens scroll on their own')
  assert.doesNotMatch(screenRule, /min-height: var\(--viewport-height\)/, 'a min-height alone cannot scroll while page scrolling is disabled')

  // 例外只有战斗屏：保持自然高度，不改变棋盘滑动行为。
  assert.match(read('components/screens/BattleScreen.vue'), /\.battle-screen \{[^}]*height: auto;[^}]*overflow: visible/, 'the battle screen keeps its natural height')

  const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const relative = `${dir}/${entry.name}`
    return entry.isDirectory() ? walk(relative) : entry.name.endsWith('.vue') ? [relative] : []
  })
  const screenFiles = walk('components').filter(file => /<view[^>]*class="screen /.test(read(file)))
  assert.ok(screenFiles.length >= 9, 'every screen root is found')
  for (const file of screenFiles) {
    if (file === 'components/screens/BattleScreen.vue') continue
    const roots = read(file).match(/<view[^>]*class="screen [a-z-]+"[^>]*>/g) ?? []
    assert.equal(roots.length, 1, `${file}: one screen root`)
    assert.match(roots[0], /@touchmove\.stop/, `${file}: touch moves on the screen never reach the framework's page-scroll blocker`)
  }
}
