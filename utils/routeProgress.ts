/** 地图底部进度文案：区分“刚完成的一层”和“下一步可选的一层”，避免把两者混称为当前位置。 */
export function routeProgressText(nextLayer: number | null, finishedLayer: number | null, optionCount: number): string {
  if (!nextLayer || optionCount <= 0) return '沿着足迹，继续远征'
  return finishedLayer
    ? `第 ${finishedLayer} 层已完成 · 第 ${nextLayer} 层有 ${optionCount} 条路可选`
    : `第 ${nextLayer} 层有 ${optionCount} 条路可选`
}
