import { describe, it, expect } from 'vitest'
import { t, formatPrice, getLocale } from './index'

describe('t() - translation lookup', () => {
  it('returns PT translations by default', () => {
    const tr = t(null)
    expect(tr.common.save).toBe('Guardar')
  })

  it('returns PT translations for "pt"', () => {
    const tr = t('pt')
    expect(tr.booking.confirmBooking).toBe('Confirmar marcação')
  })

  it('returns EN translations for "en"', () => {
    const tr = t('en')
    expect(tr.common.save).toBe('Save')
    expect(tr.booking.confirmBooking).toBe('Confirm booking')
  })

  it('falls back to PT for unsupported locale', () => {
    const tr = t('fr')
    expect(tr.common.save).toBe('Guardar')
  })
})

describe('getLocale', () => {
  it('returns "pt" for null', () => {
    expect(getLocale(null)).toBe('pt')
  })

  it('returns "pt" for undefined', () => {
    expect(getLocale(undefined)).toBe('pt')
  })

  it('returns "en" for "en"', () => {
    expect(getLocale('en')).toBe('en')
  })

  it('returns "pt" for unsupported locale', () => {
    expect(getLocale('de')).toBe('pt')
  })
})

describe('formatPrice', () => {
  it('formats EUR in PT locale', () => {
    const result = formatPrice(1500, 'EUR', 'pt')
    // Should contain "15" and "€"
    expect(result).toContain('15')
    expect(result).toContain('€')
  })

  it('formats EUR in EN locale', () => {
    const result = formatPrice(1500, 'EUR', 'en')
    expect(result).toContain('15')
    expect(result).toContain('€')
  })

  it('formats zero correctly', () => {
    const result = formatPrice(0, 'EUR', 'pt')
    expect(result).toContain('0')
  })
})
