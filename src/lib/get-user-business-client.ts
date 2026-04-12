import type { SupabaseClient } from '@supabase/supabase-js'
import type { Business } from '@/types/database'

/**
 * Client-side: get the business for the current user via business_members.
 */
export async function getUserBusinessClient(supabase: SupabaseClient): Promise<{ user: { id: string; email?: string; user_metadata?: Record<string, string> } | null; business: Business | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, business: null }

  // Try via business_members
  const { data: membership } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (membership) {
    const { data: biz } = await supabase.from('businesses').select('*').eq('id', membership.business_id).single()
    return { user, business: (biz as Business) || null }
  }

  // Fallback: owner_id
  const { data: biz } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
  return { user, business: (biz as Business) || null }
}
