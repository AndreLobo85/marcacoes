import type { PaymentMode } from '@/types/database'

export interface CalculateDepositInput {
  totalPriceCents: number
  paymentMode: PaymentMode
  depositAmountCents: number | null
  depositPercent: number | null
}

export interface CalculateDepositResult {
  amountCents: number
  isRequired: boolean
}

export interface CreateCheckoutInput {
  bookingId: string
  businessId: string
  stripeAccountId: string
  amountCents: number
  currency: string
  customerEmail: string | null
  successUrl: string
  cancelUrl: string
}
