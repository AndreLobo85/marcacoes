import { NextResponse, type NextRequest } from 'next/server'

/**
 * Stripe webhook handler — DISABLED until Stripe SDK is installed and configured.
 *
 * To enable:
 * 1. npm install stripe
 * 2. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET env vars
 * 3. Uncomment the verification logic and replace the 501 response
 */
export async function POST(request: NextRequest) {
  // Guard: reject all requests until Stripe is properly configured
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Stripe webhooks are not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.' },
      { status: 501 }
    )
  }

  // TODO: When Stripe SDK is installed, replace with:
  // import Stripe from 'stripe'
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  // const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)

  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
