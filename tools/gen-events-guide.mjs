// 从 core/events.ts 源码生成 EVENTS_GUIDE.md 的逐项表格，保证文档与源码一致。
// 默认 --check 只读校验（与磁盘不一致即失败）；--write 才写入。
// 纯渲染函数导出供 tools/tests/gen-events-guide.mjs 单测使用。
import { loadProject } from './harness.mjs'
import { RULE_VERSION } from './simulate.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const events = loadProject('./core/events')
const { cardById } = loadProject('./core/upgrade')
const { consumableById } = loadProject('./core/consumables')

function grantsText(effect) {
  const parts = []
  for (const grant of effect.cardGrants ?? effect.grants ?? []) {
    const def = cardById(grant.id)
    const toneText = def?.cardClass === 'gold' ? '金卡' : def?.cardClass === 'purple' ? '紫卡' : def?.cardClass === 'black' ? '黑卡' : def?.cardClass === 'red' ? '红卡' : def?.cardClass === 'blue' ? '蓝卡' : def?.cardClass === 'white' ? '白卡' : def?.name
    parts.push(`${toneText} ${grant.id} ×${grant.count}`)
  }
  for (const grant of effect.consumableGrants ?? []) parts.push(`道具 ${grant.id} ×${grant.count}`)
  return parts.join(' + ')
}

function effectText(effect) {
  const range = value => typeof value === 'number' ? `${value}` : `${value.min}~${value.max}`
  switch (effect.type) {
    case 'gold': {
      const numeric = typeof effect.value === 'number' ? effect.value : effect.value.min
      return numeric > 0 ? `获得 ${range(effect.value)} 金币` : numeric < 0 ? `失去 ${-effect.value} 金币` : '无事发生（金币不变）'
    }
    case 'none': return '无事发生'
    case 'heal': return `回复生命上限的 ${range(effect.value)}%`
    case 'heal_curse': return `回复 ${effect.heal}% 后基础生命上限 −${effect.curse_hp}%（最低 10）`
    case 'hp_reduce': return `失去 ${range(effect.value)} 点生命（留 1）`
    case 'hp_reduce_pct': return `当前生命 −${effect.value}%（留 1）${effect.atk_mult ? `，攻击倍率 +${Math.round(effect.atk_mult * 100)} 个百分点` : ''}${effect.def_mult ? `，防御倍率 +${Math.round(effect.def_mult * 100)} 个百分点` : ''}`
    case 'maxhp_down_pct': return `基础生命上限 −${effect.value}%（最低 10）${effect.def_mult ? `，防御倍率 +${Math.round(effect.def_mult * 100)} 个百分点` : ''}${effect.atk_mult ? `，攻击倍率 +${Math.round(effect.atk_mult * 100)} 个百分点` : ''}`
    case 'maxhp_up': return `基础生命上限 +${effect.value}`
    case 'xp': return `获得 ${range(effect.value)} 经验`
    case 'gold_heal': return `回复 ${effect.heal}% 并获得 ${range(effect.gold)} 金币`
    case 'gold_xp': return `获得 ${range(effect.gold)} 金币和 ${range(effect.xp)} 经验`
    case 'drop_equip': return `获得随机${({ common: '普通', rare: '稀有', epic: '史诗' })[effect.rarity]}装备 ×1${effect.cost ? `，支付 ${effect.cost} 金币` : ''}（具体 ID/等级/浮动结算时随机）`
    case 'reforge': return `消耗背包首件未装备普通装备，换随机${({ common: '普通', rare: '稀有', epic: '史诗' })[effect.new_rarity]}装备 ×1 + ${range(effect.sell_price)} 金币`
    case 'card_trade': {
      const bits = []
      if (effect.cost) bits.push(`支付 ${effect.cost} 金币`)
      if (effect.hpCost) bits.push(`支付 ${effect.hpCost} 点生命`)
      if (effect.removesPurple) bits.push(`净化紫卡 ${effect.removesPurple} 层`)
      const g = grantsText(effect)
      if (g) bits.push(`获得 ${g}`)
      if (effect.gold) bits.push(`另获 ${range(effect.gold)} 金币`)
      return bits.join('，') || '无变化'
    }
    default: return `未知效果 ${effect.type}`
  }
}

const toneMark = { good: '✦', mid: '•', bad: '✗' }
// 代价列与 EventPanel 共用 core/events.ts 的 summarizeChoiceCost：支付与前提条件，混合档给范围/上限。
export function choiceRow(choice) {
  const cost = events.summarizeChoiceCost(choice.outcomes) ?? '无'
  const tiers = choice.outcomes.map(o => `${o.weight}% ${toneMark[o.tone]}${o.label}：${effectText(o.effect)}`).join('<br>')
  return `| ${choice.label} | ${cost} | ${tiers} |`
}

const stageName = { 1: 'S1+', 2: 'S2+', 3: 'S3+' }

/** 从事件目录渲染完整指南文本；计数与阶段池全部动态派生，不硬编码。 */
export function renderGuide(catalog) {
  const choiceCount = catalog.reduce((sum, event) => sum + event.choices.length, 0)
  const outcomeCount = catalog.reduce((sum, event) => sum + event.choices.reduce((inner, choice) => inner + choice.outcomes.length, 0), 0)
  const poolAt = stage => catalog.filter(event => event.stageMin <= stage).length
  const byStage = new Map()
  for (const event of catalog) {
    if (!byStage.has(event.stageMin)) byStage.set(event.stageMin, [])
    byStage.get(event.stageMin).push(event)
  }
  const sections = []
  let num = 0
  for (const stage of [...byStage.keys()].sort((a, b) => a - b)) {
    for (const event of byStage.get(stage)) {
      num += 1
      sections.push(`### ${String(num).padStart(2, '0')} ${event.title} · \`${event.id}\`

\`stageMin: ${event.stageMin}\`（${stageName[stage] ?? `S${stage}+`}）；${event.choices.length} 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
${event.choices.map(choiceRow).join('\n')}`)
    }
  }
  const header = `# 奇遇事件指南（${RULE_VERSION}）

> 按当前 \`core/events.ts\` 自动生成（\`tools/gen-events-guide.mjs\`，默认只读校验，\`--write\` 才写入）。共 **${catalog.length} 个强制事件、${choiceCount} 个选项、${outcomeCount} 档随机结果**：点选即结算，结果页展示本次档位与收获；选项只显示代价，收获完全不预告。抽取时不可行档（金币/生命/紫卡不足）自动剔除，剩余档按权重归一化。本文若与源码冲突，以源码为准。
>
> 入口：[README.md](./README.md) · 系统与职责：[PROJECT_ANALYSIS.md](./PROJECT_ANALYSIS.md#10-事件系统) · 卡牌和道具详单：[SIXCOLOR_RULES.md](./SIXCOLOR_RULES.md)。

## 通用规则

- **强制选择**：所有事件 \`forced: true\`，必须选一项，无法跳过也无法离开；每事件至少有一个选项的**全部三档**零依赖金币、生命或持有物，0 金残血也能推进。
- **点选即结算**：\`CHOOSE_EVENT(index)\` 在一次确定性作用域 RNG（\`event-choice\` + 选项序号）内完成 1 次分支抽取 + 档内结算（金币区间再抽 1 次、随机装备抽 3 次、重铸抽 4 次），立即落地并缓存 \`eventResult\`；结果页只做展示，「离开」(\`LEAVE_EVENT\`) 后回路线或接升级奖励队列。随机只抽一次，不可重选。
- **代价显示**：选项卡只显示 label 与交易代价行（金币/生命支付与紫卡/重铸前提，混合档显示范围或上限）；收获不预告。禁用的选项显示动态原因（如「金币不足：需要 35 金币」）；只有三档全部不可行时才整项禁用，部分不可行档在抽取时剔除。
- **交易先扣后发**：先收金币奖励、再扣成本、再发卡/道具、最后逐层净化首张紫卡；\`hpCost\` 要求支付后至少保留 1 点。主动支付（购买/赌注/投币）计入「挥金如土」消费成长，意外损失不计。黑卡三档都给（是固定代价），直接生效且本局不可解除，没有确认步骤。
- **档位标记**：✦ good（结果页金色）/ • mid（正文色）/ ✗ bad（警示红）。
- 装备奖励结算时从品质池随机基础 ID + 等级 \`(stage-1)×2+1 或 +1\` + 浮动 70–130；金币/经验区间含两端、等概率。
- 阶段池：S1 ${poolAt(1)} / S2 ${poolAt(2)} / S3+ ${poolAt(3)}，按 \`stageMin ≤ stage\` 均匀抽取，无跨节点去重。
`

  const footer = `
## 引擎职责（核对时的函数定位）

| 位置 | 职责 |
|---|---|
| \`core/events.ts\` \`EventOutcome\`/\`EventChoice\` | weight/label/tone/effect 数据契约；选项恰好 3 档、权重和 100 |
| \`resolveEventOutcome\` | 可行档过滤（不可行档剔除）→ 权重归一化抽分支 → \`resolveEventEffect\` 档内结算 |
| \`getEventChoiceDisabledReasonForChoice\` | 三档结构校验 + 至少一档可行；全部不可行时返回首档原因 |
| \`core/events.ts\` \`getEventCatalog\`/\`summarizeChoiceCost\` | 只读事件目录与选项代价摘要（UI 选项卡与本文档表格共用） |
| \`store/gameStore.ts\` \`CHOOSE_EVENT\`/\`LEAVE_EVENT\` | 点选即结算（invariant fail-fast）+ 结果页缓存/离开 |
| \`tools/simulate.mjs\` \`pickEventChoice\`/\`choiceScore\` | 机器人按三档加权期望选选项 |
| \`tools/gen-events-guide.mjs\` | 本文档表格的自动生成器 |

## 事件列表

${sections.join('\n\n')}
`
  return header + footer
}

export function generateContent() {
  return renderGuide(events.getEventCatalog())
}

const target = path.resolve(import.meta.dirname, '../EVENTS_GUIDE.md')

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv.includes('--write') ? 'write' : 'check'
  const generated = generateContent()
  const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : ''
  if (mode === 'write') {
    fs.writeFileSync(target, generated)
    console.log(`EVENTS_GUIDE.md written (${Buffer.byteLength(generated)} bytes)`)
  } else if (generated !== existing) {
    // 定位首个差异行，方便快速修复漂移。
    const generatedLines = generated.split('\n')
    const existingLines = existing.split('\n')
    const index = generatedLines.findIndex((line, i) => line !== existingLines[i])
    console.error(`EVENTS_GUIDE.md is stale (first diff at generated line ${index + 1}:`)
    console.error(`  expected: ${JSON.stringify(generatedLines[index])}`)
    console.error(`  found:    ${JSON.stringify(existingLines[index])}`)
    console.error('Run `node tools/gen-events-guide.mjs --write` after reviewing the change.')
    process.exitCode = 1
  } else {
    console.log('EVENTS_GUIDE.md is up to date with core/events.ts')
  }
}
