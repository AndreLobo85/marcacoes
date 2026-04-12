import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/is-super-admin'

/**
 * POST /api/internal/create-admin
 * Super admin creates a new platform user.
 * Uses Supabase admin client if available, falls back to signUp.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { isAdmin, userId: adminUserId } = await isSuperAdmin(supabase)
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

  // Try admin client first, fall back to signUp
  let newUserId: string | null = null
  let adminClient: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient> | null = null

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    adminClient = createAdminClient()

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find((u) => u.email === email)

    if (existingUser) {
      newUserId = existingUser.id
    } else {
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      })

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Admin client failed')
      }
      newUserId = authData.user.id
    }
  } catch {
    // Fallback: use signUp (works without service_role key)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (signUpError) {
      return NextResponse.json({ error: signUpError.message }, { status: 500 })
    }

    newUserId = signUpData.user?.id || null
  }

  if (!newUserId) {
    return NextResponse.json({ error: 'Não foi possível criar o utilizador' }, { status: 500 })
  }

  // Use admin client for DB operations to bypass RLS, fallback to session client
  const dbClient = adminClient || supabase

  // Make super admin if requested
  if (makeSuperAdmin) {
    const { error: saError } = await dbClient.from('super_admins').insert({ user_id: newUserId, email })
    if (saError) {
      return NextResponse.json({ error: `Utilizador criado mas erro ao definir super admin: ${saError.message}` }, { status: 500 })
    }
  }

  // Link to business if provided
  if (businessId && role) {
    const { error: bmError } = await dbClient.from('business_members').insert({
      business_id: businessId,
      user_id: newUserId,
      role,
      invited_email: email,
      joined_at: new Date().toISOString(),
      is_active: true,
    })
    if (bmError) {
      return NextResponse.json({ error: `Utilizador criado mas erro ao associar negócio: ${bmError.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, userId: newUserId, email, name, makeSuperAdmin })
}
