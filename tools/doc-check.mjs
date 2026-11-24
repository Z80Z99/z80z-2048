// 文档生成器的只读比对：统一 CRLF/LF 后再比较。
// Windows 上 core.autocrlf=true 的检出会把行尾改写成 CRLF，这不是内容漂移；
// 只有行内文字变化才算过期。
export const normalizeEol = text => text.replace(/\r\n/g, '\n')

/** 返回首个差异 { line, expected, found }；内容完全一致返回 null。 */
export function firstDiff(generated, existing) {
  const expectedLines = normalizeEol(generated).split('\n')
  const actualLines = normalizeEol(existing ?? '').split('\n')
  let index = expectedLines.findIndex((line, i) => line !== actualLines[i])
  // 逐行相同但长度不同（多出或缺少结尾行）同样算漂移。
  if (index < 0 && expectedLines.length !== actualLines.length) index = Math.min(expectedLines.length, actualLines.length)
  if (index < 0) return null
  return { line: index + 1, expected: expectedLines[index] ?? '', found: actualLines[index] ?? '' }
}
