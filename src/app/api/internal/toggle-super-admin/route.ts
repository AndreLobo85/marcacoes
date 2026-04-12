import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/is-super-admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { isAdmin } = await isSuperAdmin(supabase)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, email, remove } = (await request.json()) as {
    userId: string
    email: string
    remove: boolean
  }

  if (!userId) {
    return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })
  }

  let adminClient
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    adminClient = createAdminClient()
  } catch {
    adminClient = supabase
  }

  if (remove) {
    const { error } = await adminClient.from('super_admins').delete().eq('user_id', userId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, action: 'removed' })
  }

  const { error } = await adminClient.from('super_admins').insert({ user_id: userId, email })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, action: 'added' })
}
