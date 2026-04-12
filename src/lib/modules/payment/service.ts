import type { CalculateDepositInput, CalculateDepositResult } from './types'

/**
 * Calculate the deposit amount based on business payment settings.
 * All amounts in minor units (cents).
 */
export function calculateDeposit(input: CalculateDepositInput): CalculateDepositResult {
  const { totalPriceCents, paymentMode, depositAmountCents, depositPercent } = input

  switch (paymentMode) {
    case 'none':
      return { amountCents: 0, isRequired: false }

    case 'full_prepay':
      return { amountCents: totalPriceCents, isRequired: true }

    case 'deposit_fixed': {
      if (depositAmountCents === null || depositAmountCents <= 0) {
        return { amountCents: 0, isRequired: false }
      }
      const capped = Math.min(depositAmountCents, totalPriceCents)
      return { amountCents: capped, isRequired: true }
    }

    case 'deposit_percent': {
      if (depositPercent === null || depositPercent <= 0) {
        return { amountCents: 0, isRequired: false }
      }
      const amount = Math.ceil(totalPriceCents * depositPercent / 100)
      return { amountCents: amount, isRequired: true }
    }

    default:
      return { amountCents: 0, isRequired: false }
  }
}
