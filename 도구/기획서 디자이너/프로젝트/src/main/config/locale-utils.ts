import type { PPTDatabase } from '../db/database'

export type AppLocale = 'zh' | 'en'

export const uiText = (locale: AppLocale, zh: string, en: string): string =>
  locale === 'en' ? en : zh

export async function readAppLocale(ctx: {
  db: Pick<PPTDatabase, 'getSetting'>
}): Promise<AppLocale> {
  const locale = await ctx.db.getSetting<string>('locale').catch(() => 'ko')
  // Korean UI currently reuses the English backend message branch so no Chinese
  // error or status string can leak into the Korean interface.
  return locale === 'zh' ? 'zh' : 'en'
}
