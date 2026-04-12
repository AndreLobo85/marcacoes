import type { SupabaseClient } from '@supabase/supabase-js'
import type { Business } from '@/types/database'

/**
 * Client-side: get the business for the current user.
 * Checks localStorage for selected_business_id first (supports multi-business / super admin).
 * Falls back to business_members, then owner_id.
 */
export async function getUserBusinessClient(supabase: SupabaseClient): Promise<{ user: { id: string; email?: string; user_metadata?: Record<string, string> } | null; business: Business | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, business: null }

  // Check if a specific business is selected (multi-business / super admin)
  const selectedId = typeof window !== 'undefined' ? localStorage.getItem('selected_business_id') : null
  if (selectedId) {
    const { data: biz } = await supabase.from('businesses').select('*').eq('id', selectedId).single()
    if (biz) return { user, business: biz as Business }
  }

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
