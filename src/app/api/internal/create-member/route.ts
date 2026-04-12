import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/internal/create-member
 * Owner creates a new team member with email + password directly.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { businessId, email, password, name, role } = body as {
    businessId: string; email: string; password: string; name: string; role: string
  }

  if (!businessId || !email || !password || !name || !role) {
    return NextResponse.json({ error: 'Campos obrigatórios: email, password, nome, role' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  // Verify user is owner of this business or super admin
  const { data: member } = await supabase
    .from('business_members')
    .select('role')
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member || !['owner', 'manager'].includes(member.role)) {
    const { data: adminCheck } = await supabase.from('super_admins').select('id').eq('user_id', user.id).single()
    if (!adminCheck) {
      return NextResponse.json({ error: 'Apenas owners e managers podem criar membros' }, { status: 403 })
    }
  }

  // Use admin client for all operations
  const admin = createAdminClient()

  // Create or find auth user
  let newUserId: string | null = null

  // Check if user already exists
  const { data: existingUsers } = await admin.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find((u) => u.email === email)

  if (existingUser) {
    newUserId = existingUser.id
  } else {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: name },
    })
    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Erro ao criar utilizador' }, { status: 500 })
    }
    newUserId = authData.user.id
  }

  if (!newUserId) {
    return NextResponse.json({ error: 'Não foi possível criar o utilizador' }, { status: 500 })
  }

  // Insert into business_members using admin client (bypasses RLS)
  const { error: memberError } = await admin.from('business_members').insert({
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

  return NextResponse.json({ success: true, userId: newUserId, email, name, role })
}
