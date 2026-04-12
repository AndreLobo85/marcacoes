import { createClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client with service_role key.
 * NEVER expose this to the browser.
 * Use for operations that need to bypass RLS (webhooks, system operations).
 *
 * Note: We don't pass the Database generic here because the admin client
 * is used for system operations where strict typing is less important
 * than flexibility (webhook handlers, background jobs).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL')
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
