export const SUPPORTED_LOCALES = ['pt', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'pt'

export function isValidLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale)
}

export function getLocale(locale: string | null | undefined): Locale {
  if (locale && isValidLocale(locale)) return locale
  return DEFAULT_LOCALE
}
