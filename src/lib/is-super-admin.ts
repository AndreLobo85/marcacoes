import type { SupabaseClient } from '@supabase/supabase-js'

export async function isSuperAdmin(supabase: SupabaseClient): Promise<{ isAdmin: boolean; userId: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isAdmin: false, userId: null }

  const { data } = await supabase
    .from('super_admins')
    .select('id')
    .eq('user_id', user.id)
    .single()

  return { isAdmin: !!data, userId: user.id }
}
