import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/internal/create-member
 * Owner creates a new team member with email + password directly.
 * No invite/acceptance needed — member can login immediately.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 1. Verify authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { businessId, email, password, name, role } = body as {
    businessId: string
    email: string
    password: string
    name: string
    role: string
  }

  if (!businessId || !email || !password || !name || !role) {
    return NextResponse.json({ error: 'Campos obrigatórios: email, password, nome, role' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  // 2. Verify user is owner of this business
  const { data: member } = await supabase
    .from('business_members')
    .select('role')
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: 'Apenas o owner pode criar membros' }, { status: 403 })
  }

  // 3. Create auth user via admin client (service_role)
  const adminClient = createAdminClient()

  // Check if user already exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find((u) => u.email === email)

  let newUserId: string

  if (existingUser) {
    // User already has an auth account — just add as member
    newUserId = existingUser.id
  } else {
    // Create new auth account
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Erro ao criar conta' }, { status: 500 })
    }

    newUserId = authData.user.id
  }

  // 4. Add as business member
  const { error: memberError } = await supabase.from('business_members').insert({
    business_id: businessId,
    user_id: newUserId,
    role,
    invited_email: email,
    joined_at: new Date().toISOString(),
    is_active: true,
  })

  if (memberError) {
    if (memberError.message.includes('duplicate') || memberError.code === '23505') {
      return NextResponse.json({ error: 'Este email já é membro deste negócio' }, { status: 400 })
    }
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    userId: newUserId,
    email,
    name,
    role,
  })
}
