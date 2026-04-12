import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/is-super-admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { isAdmin } = await isSuperAdmin(supabase)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, businessId } = (await request.json()) as {
    userId: string
    businessId: string
  }

  if (!userId || !businessId) {
    return NextResponse.json({ error: 'userId e businessId obrigatórios' }, { status: 400 })
  }

  let adminClient
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    adminClient = createAdminClient()
  } catch {
    adminClient = supabase
  }

  const { error } = await adminClient
    .from('business_members')
    .delete()
    .eq('user_id', userId)
    .eq('business_id', businessId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
