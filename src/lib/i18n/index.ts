import { pt, type Translations } from './pt'
import { en } from './en'
import { getLocale, type Locale } from './config'

const translations: Record<Locale, Translations> = { pt, en }

/**
 * Get translations for a given locale.
 * Falls back to 'pt' if the locale is not supported.
 */
export function t(locale: string | null | undefined): Translations {
  const resolvedLocale = getLocale(locale)
  return translations[resolvedLocale]
}

/**
 * Format a price in minor units to a display string.
 * e.g. formatPrice(1500, 'EUR', 'pt') -> "15,00 €"
 */
export function formatPrice(cents: number, currency: string, locale: string): string {
  const amount = cents / 100
  const resolvedLocale = locale === 'pt' ? 'pt-PT' : 'en-GB'
  return new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency,
  }).format(amount)
}

export { getLocale, type Locale } from './config'
export type { Translations } from './pt'
