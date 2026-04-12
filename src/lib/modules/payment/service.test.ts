import { describe, it, expect } from 'vitest'
import { calculateDeposit } from './service'

describe('calculateDeposit', () => {
  it('returns 0 when payment mode is none', () => {
    const result = calculateDeposit({
      totalPriceCents: 5000,
      paymentMode: 'none',
      depositAmountCents: null,
      depositPercent: null,
    })
    expect(result.amountCents).toBe(0)
    expect(result.isRequired).toBe(false)
  })

  it('returns full amount for full_prepay', () => {
    const result = calculateDeposit({
      totalPriceCents: 5000,
      paymentMode: 'full_prepay',
      depositAmountCents: null,
      depositPercent: null,
    })
    expect(result.amountCents).toBe(5000)
    expect(result.isRequired).toBe(true)
  })

  it('returns fixed deposit amount for deposit_fixed', () => {
    const result = calculateDeposit({
      totalPriceCents: 5000,
      paymentMode: 'deposit_fixed',
      depositAmountCents: 1000,
      depositPercent: null,
    })
    expect(result.amountCents).toBe(1000)
    expect(result.isRequired).toBe(true)
  })

  it('caps fixed deposit at total price', () => {
    const result = calculateDeposit({
      totalPriceCents: 500,
      paymentMode: 'deposit_fixed',
      depositAmountCents: 1000,
      depositPercent: null,
    })
    expect(result.amountCents).toBe(500)
    expect(result.isRequired).toBe(true)
  })

  it('returns percentage deposit for deposit_percent', () => {
    const result = calculateDeposit({
      totalPriceCents: 5000,
      paymentMode: 'deposit_percent',
      depositAmountCents: null,
      depositPercent: 20,
    })
    expect(result.amountCents).toBe(1000)
    expect(result.isRequired).toBe(true)
  })

  it('rounds up percentage deposit to nearest cent', () => {
    const result = calculateDeposit({
      totalPriceCents: 3333,
      paymentMode: 'deposit_percent',
      depositAmountCents: null,
      depositPercent: 10,
    })
    // 3333 * 10 / 100 = 333.3 → ceil = 334
    expect(result.amountCents).toBe(334)
    expect(result.isRequired).toBe(true)
  })

  it('returns 0 for deposit_fixed with null amount', () => {
    const result = calculateDeposit({
      totalPriceCents: 5000,
      paymentMode: 'deposit_fixed',
      depositAmountCents: null,
      depositPercent: null,
    })
    expect(result.amountCents).toBe(0)
    expect(result.isRequired).toBe(false)
  })

  it('returns 0 for deposit_percent with null percent', () => {
    const result = calculateDeposit({
      totalPriceCents: 5000,
      paymentMode: 'deposit_percent',
      depositAmountCents: null,
      depositPercent: null,
    })
    expect(result.amountCents).toBe(0)
    expect(result.isRequired).toBe(false)
  })
})
