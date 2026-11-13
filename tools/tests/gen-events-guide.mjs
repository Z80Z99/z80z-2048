// 事件指南生成器回归：纯渲染函数、动态计数、代价列与磁盘 --check 一致性；不写文件。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadProject } from '../harness.mjs'
import { choiceRow, renderGuide, generateContent } from '../gen-events-guide.mjs'
import { RULE_VERSION } from '../simulate.mjs'

const events = loadProject('./core/events')

export async function run() {
  // choiceRow：代价列取 effect 字段（而非档对象），三档权重/tone/效果完整渲染。
  {
    const catalog = events.getEventCatalog()
    const byId = new Map(catalog.map(event => [event.id, event]))
    const stake = choiceRow(byId.get('gambler').choices[0])
    assert.match(stake, /^\| 赌一把（20 金币） \| 支付20 金币 \| 45% ✦手气极佳：/)
    assert.ok(stake.includes('30% ✗输个精光：失去 20 金币'), 'bad tier rendered with its loss')
    const free = choiceRow(byId.get('treasure_chest').choices[0])
    assert.match(free, /^\| 撬开箱盖 \| 无 \| 40% ✦满载：获得 18~30 金币/)
    assert.ok(!choiceRow(byId.get('healing_fountain').choices[0]).includes('cost'), 'cost text derives from effect payloads only')
  }

  // renderGuide：计数、阶段池与标题全部动态派生，合成目录可验证。
  {
    const synthetic = [
      { id: 'syn_a', title: '甲', icon: '', desc: '', stageMin: 1, forced: true, choices: [
        { label: '免费', outcomes: [1, 2, 3].map((weight, index) => ({ weight, label: `档${index}`, tone: 'mid', effect: { type: 'none' } })) },
      ] },
      { id: 'syn_b', title: '乙', icon: '', desc: '', stageMin: 2, forced: true, choices: [
        { label: '付费', outcomes: [1, 2, 3].map((weight, index) => ({ weight, label: `档${index}`, tone: 'mid', effect: { type: 'gold', value: -10 } })) },
        { label: '还是免费', outcomes: [1, 2, 3].map((weight, index) => ({ weight, label: `档${index}`, tone: 'mid', effect: { type: 'none' } })) },
      ] },
    ]
    const rendered = renderGuide(synthetic)
    assert.match(rendered, /共 \*\*2 个强制事件、3 个选项、9 档随机结果\*\*/)
    assert.match(rendered, /阶段池：S1 1 \/ S2 2 \/ S3\+ 2/)
    assert.match(rendered, /### 01 甲 · `syn_a`/)
    assert.match(rendered, /### 02 乙 · `syn_b`/)
    assert.match(rendered, /\| 付费 \| 支付10 金币 \|/, 'synthetic paid tier renders its stake')
    assert.match(rendered, new RegExp(`奇遇事件指南（${RULE_VERSION}）`), 'title carries the live rule version')
    const full = renderGuide(events.getEventCatalog())
    assert.match(full, /共 \*\*34 个强制事件、113 个选项、339 档随机结果\*\*/)
    assert.match(full, /阶段池：S1 12 \/ S2 26 \/ S3\+ 34/)
  }

  // 磁盘一致性：生成内容与 EVENTS_GUIDE.md 完全一致（--check 的只读断言）。
  {
    const target = path.resolve(import.meta.dirname, '../../EVENTS_GUIDE.md')
    const existing = fs.readFileSync(target, 'utf8')
    assert.equal(generateContent(), existing, 'EVENTS_GUIDE.md must match core/events.ts (run gen-events-guide.mjs --write after intentional changes)')
  }
}
