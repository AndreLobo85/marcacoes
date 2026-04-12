import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature } from '@/lib/modules/notification/service'
import type { NotificationStatus, DeliveryStatus } from '@/types/database'

/**
 * n8n delivery callback webhook.
 * n8n calls this endpoint to report notification delivery status.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-webhook-signature')
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  const rawBody = await request.text()

  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: {
    eventId: string
    channel: string
    recipient: string
    status: 'delivered' | 'failed' | 'bounced'
    externalId?: string
    errorMessage?: string
  }

  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Update notification event status
  const eventStatus: NotificationStatus = body.status === 'delivered' ? 'sent' : 'failed'
  await supabase
    .from('notification_events')
    .update({
      status: eventStatus,
      processed_at: new Date().toISOString(),
    })
    .eq('id', body.eventId)

  // Insert delivery record
  const deliveryStatus: DeliveryStatus = body.status
  await supabase.from('notification_deliveries').insert({
    event_id: body.eventId,
    channel: body.channel,
    recipient: body.recipient,
    status: deliveryStatus,
    external_id: body.externalId || null,
    error_message: body.errorMessage || null,
    delivered_at: body.status === 'delivered' ? new Date().toISOString() : null,
    sent_at: new Date().toISOString(),
  })

  return NextResponse.json({ received: true })
}
