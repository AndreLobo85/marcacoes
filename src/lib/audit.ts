import type { SupabaseClient } from '@supabase/supabase-js'

export async function logAudit(
  supabase: SupabaseClient,
  params: {
    businessId: string
    userId?: string | null
    action: string
    entityType: string
    entityId?: string
    details?: Record<string, unknown>
    ipAddress?: string | null
  }
) {
  await supabase.from('audit_log').insert({
    business_id: params.businessId,
    user_id: params.userId || null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId || null,
    details: params.details || {},
    ip_address: params.ipAddress || null,
  })
}
