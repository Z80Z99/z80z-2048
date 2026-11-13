// 从 10 份源文档生成 MASTER_DOC.md 合并阅读入口。
// 默认 --check 只读校验（与磁盘不一致即失败）；--write 才写入。
// 机械转换规则：一级标题→部分标题（带稳定 anchor）；相对 .md 链接→纯文字；
// 历史改进文档插入局部标注；第五源“本文档”→“本部分”。内容修正一律改源文档后重新生成。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PARTS = [
  { file: 'README.md', title: '项目总览' },
  { file: 'AGENTS.md', title: '协作约定' },
  { file: 'PROJECT_ANALYSIS.md', title: '系统知识库' },
  { file: 'SIXCOLOR_RULES.md', title: '六色强化与消耗品详单' },
  { file: 'EVENTS_GUIDE.md', title: '奇遇事件指南', note: '此部分表格由 tools/gen-events-guide.mjs 从 core/events.ts 自动生成；改事件后先重新生成源文件，再同步总文档。' },
  { file: 'IMPROVEMENTS.md', title: '历史改进总记录', historical: true },
  { file: 'UI_MOTION_IMPROVEMENTS.md', title: '界面减负与合并动效', historical: true },
  { file: 'MAP_IMPROVEMENTS.md', title: '纸质分叉地图', historical: true },
  { file: 'ART_IMPROVEMENTS.md', title: '怪物、物品与场景美术', historical: true },
  { file: 'MAP_ICON_IMPROVEMENTS.md', title: '地图图标', historical: true },
]

const HISTORICAL_NOTE = '> **历史记录**：本部分描述当轮改进时的设计与验证快照，条目以当时口径记录，不代表当前规则；现行规范以第一至五部分为准，冲突时以源码为准。'

function partHeading(index, title, file) {
  const original = file.replace(/\.md$/, '')
  return `<a id="part-${index + 1}"></a>\n\n# 第${index + 1}部分 · ${title}（原 ${original}.md）`
}

// 相对文档链接 [text](./x.md) / [text](./x.md#a) → 纯文字 text；内部锚点链接保留。
function stripRelativeLinks(text) {
  return text.replace(/\[([^\]]+)\]\(\.\.?\/[^)]+?\.md(?:#[^)]*)?\)/g, '$1')
}

function renderPart(index, source) {
  let text = source.replace(/^# .*\r?\n?/, '').replace(/\s+$/, '')
  text = stripRelativeLinks(text)
  if (index === 4) text = text.replaceAll('本文档', '本部分')
  const heading = partHeading(index, PARTS[index].title, PARTS[index].file)
  const blocks = [heading]
  if (PARTS[index].note) blocks.push(`> ${PARTS[index].note}`)
  if (PARTS[index].historical) blocks.push(HISTORICAL_NOTE)
  blocks.push(text)
  return blocks.join('\n\n')
}

export function renderMasterDoc(readFile = name => fs.readFileSync(path.resolve(import.meta.dirname, '..', name), 'utf8')) {
  const toc = PARTS.map((part, index) =>
    `- [第${index + 1}部分 · ${part.title}](#part-${index + 1})${part.historical ? '（历史记录）' : ''}${index === 4 ? '（自动生成表）' : ''}`)
  const header = `# Z80Z 项目总文档（合并版）

> **汇总阅读入口**：本文件由 \`tools/gen-master-doc.mjs\` 从 10 份源文档机械合并生成（默认 \`--check\` 只读校验，\`--write\` 才写入）。**内容修正一律改源文档后重新生成**：事件表改 \`core/events.ts\` → \`node tools/gen-events-guide.mjs --write\` → \`node tools/gen-master-doc.mjs --write\`；其余部分直接改源 md 再同步总文档。若文档与代码冲突，以代码为准并回填源文档（沿用 AGENTS.md 约定）。
>
> 各源文档原样保留、并行维护；本总文档只是合并视图，不替代任何源文件。

## 目录

${toc.join('\n')}

---

`
  const body = PARTS.map((part, index) => renderPart(index, readFile(part.file))).join('\n\n---\n\n')
  return header + body + '\n'
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = path.resolve(import.meta.dirname, '../MASTER_DOC.md')
  const mode = process.argv.includes('--write') ? 'write' : 'check'
  const generated = renderMasterDoc()
  const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : ''
  if (mode === 'write') {
    fs.writeFileSync(target, generated)
    console.log(`MASTER_DOC.md written (${Buffer.byteLength(generated)} bytes)`)
  } else if (generated !== existing) {
    const generatedLines = generated.split('\n')
    const existingLines = existing.split('\n')
    const index = generatedLines.findIndex((line, i) => line !== existingLines[i])
    console.error(`MASTER_DOC.md is stale (first diff at generated line ${index + 1}:`)
    console.error(`  expected: ${JSON.stringify(generatedLines[index])}`)
    console.error(`  found:    ${JSON.stringify(existingLines[index])}`)
    console.error('Edit source documents, then run `node tools/gen-master-doc.mjs --write`.')
    process.exitCode = 1
  } else {
    console.log('MASTER_DOC.md is up to date with the 10 source documents')
  }
}
