// MASTER_DOC 合并入口回归：与 10 份源文档一致、行尾不敏感、十部分齐全；不写文件。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { renderMasterDoc, PARTS } from '../gen-master-doc.mjs'
import { firstDiff } from '../doc-check.mjs'

export async function run() {
  const root = path.resolve(import.meta.dirname, '../..')
  const read = name => fs.readFileSync(path.join(root, name), 'utf8')
  const existing = read('MASTER_DOC.md')
  const generated = renderMasterDoc()

  // 磁盘一致性：与 --check 相同的只读断言；源文档或成品的行尾差异都不算漂移。
  assert.equal(firstDiff(generated, existing), null, 'MASTER_DOC.md must match the 10 source documents (run gen-master-doc.mjs --write)')
  const crlfSources = Object.fromEntries(PARTS.map(part => [part.file, read(part.file).replace(/\r?\n/g, '\r\n')]))
  assert.equal(firstDiff(renderMasterDoc(name => crlfSources[name]), existing), null, 'CRLF source checkout (core.autocrlf) is not drift')
  const lfSources = Object.fromEntries(PARTS.map(part => [part.file, read(part.file).replace(/\r\n/g, '\n')]))
  assert.equal(firstDiff(renderMasterDoc(name => lfSources[name]), existing), null, 'LF source checkout is not drift')
  assert.equal(firstDiff(generated, existing.replace(/\r?\n/g, '\r\n')), null, 'CRLF master document is not drift')

  // 十部分齐全：每部分都有稳定锚点与目录链接，目录里没有断开的指向。
  assert.equal(PARTS.length, 10)
  for (const [index, part] of PARTS.entries()) {
    const anchor = `part-${index + 1}`
    assert.ok(generated.includes(`<a id="${anchor}"></a>`), `${part.file}: anchor ${anchor} rendered`)
    assert.ok(generated.includes(`[第${index + 1}部分 · ${part.title}](#${anchor})`), `${part.file}: table of contents links to ${anchor}`)
  }
  assert.equal([...generated.matchAll(/> \*\*历史记录\*\*/g)].length, PARTS.filter(part => part.historical).length, 'every historical part carries its local note')
  assert.doesNotMatch(generated, /\]\(\.\.?\/[^)]+\.md/, 'relative document links are rewritten to plain cross references')

  // 真实内容变化必须被报告。
  assert.equal(firstDiff(generated, existing.replace('汇总阅读入口', '被改动')).line > 0, true, 'a text change in the master document is reported')
  const tampered = name => name === 'README.md' ? read(name).replace('把数字化为力量', '被改动') : read(name)
  assert.equal(firstDiff(renderMasterDoc(tampered), existing).line > 0, true, 'a source document change is reported')
}
