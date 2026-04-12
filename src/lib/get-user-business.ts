import type { SupabaseClient } from '@supabase/supabase-js'
import type { Business } from '@/types/database'
import { cookies } from 'next/headers'

/**
 * Server-side: get the business for the current user.
 * Checks cookie 'selected_business_id' first (set by client via select-business page).
 * Falls back to business_members, then owner_id.
 */
export async function getUserBusiness(supabase: SupabaseClient): Promise<Business | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if a specific business is selected via cookie
  try {
    const cookieStore = await cookies()
    const selectedId = cookieStore.get('selected_business_id')?.value
    if (selectedId) {
      const { data: biz } = await supabase.from('businesses').select('*').eq('id', selectedId).single()
      if (biz) return biz as Business
    }
  } catch {
    // cookies() may throw in some contexts
  }

  // Try via business_members first
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

  // Fallback: owner_id
  const { data: biz } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  return (biz as Business) || null
}
