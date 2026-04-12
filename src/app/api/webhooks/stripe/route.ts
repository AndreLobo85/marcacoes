import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PaymentStatus, NotificationStatus } from '@/types/database'

interface StripeEvent {
  type: string
  data: {
    object: {
      id: string
      payment_intent?: string
      amount_total?: number
      amount_refunded?: number
      metadata?: Record<string, string>
    }
  }
}

/**
 * Stripe webhook handler.
 * Processes payment events from Stripe and updates booking/payment status.
 *
 * In production, verify the webhook signature using Stripe SDK:
 * stripe.webhooks.constructEvent(body, sig, endpointSecret)
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const rawBody = await request.text()

  // TODO: Verify signature with Stripe SDK when stripe is installed
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  // const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!)

  let event: StripeEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const bookingId = session.metadata?.booking_id
      const businessId = session.metadata?.business_id

      if (!bookingId || !businessId) break

      const paymentUpdate: { status: PaymentStatus; stripe_payment_intent_id: string } = {
        status: 'succeeded' as const,
        stripe_payment_intent_id: session.payment_intent || '',
      }

      await supabase
        .from('payments')
        .update(paymentUpdate)
        .eq('stripe_checkout_session_id', session.id)

      // Emit notification event
      const notifStatus: NotificationStatus = 'pending'
      await supabase.from('notification_events').insert({
        business_id: businessId,
        booking_id: bookingId,
        event_type: 'payment_succeeded',
        payload: { sessionId: session.id, amount: session.amount_total } as unknown as Record<string, never>,
        status: notifStatus,
      })

      break
    }

    case 'checkout.session.expired': {
      const session = event.data.object
      const failedStatus: { status: PaymentStatus } = { status: 'failed' as const }

      await supabase
        .from('payments')
        .update(failedStatus)
        .eq('stripe_checkout_session_id', session.id)

      break
    }

    case 'charge.refunded': {
      const charge = event.data.object
      const paymentIntentId = charge.payment_intent

      if (paymentIntentId) {
        const refundUpdate: { status: PaymentStatus; refund_amount_cents: number } = {
          status: 'refunded' as const,
          refund_amount_cents: charge.amount_refunded || 0,
        }

        await supabase
          .from('payments')
          .update(refundUpdate)
          .eq('stripe_payment_intent_id', paymentIntentId)
      }

      break
    }
  }

  return NextResponse.json({ received: true })
}
