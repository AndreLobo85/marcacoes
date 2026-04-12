import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/internal/create-member
 * Owner/manager creates a new team member with email + password directly.
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

  // Verify user is owner/manager of this business or super admin
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

  const admin = createAdminClient()

  // 1. Create or find auth user
  let newUserId: string | null = null

  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: name },
  })

  if (createError) {
    // User already exists — find their ID via direct DB query
    if (createError.message?.includes('already been registered') || createError.status === 422) {
      const { data: foundId } = await admin.rpc('find_auth_user_by_email', { p_email: email })
      if (foundId) {
        newUserId = foundId as string
      } else {
        return NextResponse.json({ error: 'Utilizador existe mas não foi possível encontrar o ID' }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: createError.message || 'Erro ao criar utilizador' }, { status: 500 })
    }
  } else {
    newUserId = authData.user?.id || null
  }

  if (!newUserId) {
    return NextResponse.json({ error: 'Não foi possível criar o utilizador' }, { status: 500 })
  }

  // 2. Upsert into business_members (handle existing members gracefully)
  const { data: existingMember } = await admin
    .from('business_members')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', newUserId)
    .maybeSingle()

  if (existingMember) {
    // Already a member — just update role and reactivate
    await admin.from('business_members')
      .update({ role, is_active: true })
      .eq('id', existingMember.id)
  } else {
    const { error: memberError } = await admin.from('business_members').insert({
      business_id: businessId,
      user_id: newUserId,
      role,
      invited_email: email,
      joined_at: new Date().toISOString(),
      is_active: true,
    })
    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, userId: newUserId, email, name, role })
}
