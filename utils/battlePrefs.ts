// 界面偏好（本机保存，不属于存档 meta）：目前只有「跳过每回合结算界面」。
// 数据损坏或首次运行时回退默认值，不覆盖原存储。
export interface BattlePreferences {
  skipRoundEnd: boolean
}

const PREFS_KEY = 'z80z_prefs'

const defaults = (): BattlePreferences => ({ skipRoundEnd: false })

/** 只接受明确的 true；其余任何值（含无法解析的字符串）都按关闭处理。 */
export function parseBattlePrefs(raw: unknown): BattlePreferences {
  let parsed = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return defaults()
    }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return { skipRoundEnd: (parsed as Record<string, unknown>).skipRoundEnd === true }
  }
  return defaults()
}

export function loadBattlePrefs(): BattlePreferences {
  try {
    return parseBattlePrefs(uni.getStorageSync(PREFS_KEY))
  } catch {
    // 首次运行或旧数据损坏时使用默认值，不覆盖原存储。
    return defaults()
  }
}

export function saveBattlePrefs(prefs: BattlePreferences): void {
  try {
    uni.setStorageSync(PREFS_KEY, JSON.stringify({ skipRoundEnd: prefs.skipRoundEnd === true }))
  } catch (error) {
    console.error('Failed to save battle preferences:', error)
  }
}
