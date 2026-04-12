import type { SupabaseClient } from '@supabase/supabase-js'
import type { Business } from '@/types/database'

/**
 * Get the business for the current user.
 * Looks up via business_members (supports all roles, not just owner).
 * Falls back to businesses.owner_id for backwards compatibility.
 */
export async function getUserBusiness(supabase: SupabaseClient): Promise<Business | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Try via business_members first (supports staff, manager, receptionist)
  const { data: membership } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (membership) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', membership.business_id)
      .single()
    return (biz as Business) || null
  }

  // Fallback: owner_id (for legacy or if business_members not populated)
  const { data: biz } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  return (biz as Business) || null
}
