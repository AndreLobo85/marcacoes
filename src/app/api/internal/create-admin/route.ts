import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/is-super-admin'

/**
 * POST /api/internal/create-admin
 * Super admin creates a new platform user (optionally as super admin, optionally linked to a business).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { isAdmin } = await isSuperAdmin(supabase)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { email, password, name, makeSuperAdmin, businessId, role } = body as {
    email: string
    password: string
    name: string
    makeSuperAdmin: boolean
    businessId?: string
    role?: string
  }

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Email, password e nome são obrigatórios' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Check if user exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find((u) => u.email === email)

  let userId: string

  if (existingUser) {
    userId = existingUser.id
  } else {
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Erro ao criar conta' }, { status: 500 })
    }
    userId = authData.user.id
  }

  // Make super admin if requested
  if (makeSuperAdmin) {
    await supabase.from('super_admins').insert({ user_id: userId, email }).select().single()
  }

  // Link to business if provided
  if (businessId && role) {
    const { error: memberError } = await supabase.from('business_members').insert({
      business_id: businessId,
      user_id: userId,
      role,
      invited_email: email,
      joined_at: new Date().toISOString(),
      is_active: true,
    })

    if (memberError && !memberError.message.includes('duplicate')) {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, userId, email, name, makeSuperAdmin })
}
