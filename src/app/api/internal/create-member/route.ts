import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

/**
 * POST /api/internal/create-member
 * Creates auth user + business_member + staff_profile in one server-side call.
 * All DB operations use the admin client to bypass RLS.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 1. Verify caller is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { businessId, email, password, name, role, color, bio, sortOrder } = body as {
    businessId: string; email: string; password: string; name: string; role: string
    color?: string; bio?: string; sortOrder?: number
  }

  if (!businessId || !email || !password || !name || !role) {
    return NextResponse.json({ error: 'Campos obrigatórios: email, password, nome, role' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  // 2. Verify caller is owner/manager of this business or super admin
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

  // 3. Create or find auth user
  let newUserId: string | null = null

  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: name },
  })

  if (createError) {
    if (createError.message?.includes('already been registered') || createError.status === 422) {
      const { data: foundId } = await admin.rpc('find_auth_user_by_email', { p_email: email })
      if (foundId) {
        newUserId = foundId as string
      } else {
        return NextResponse.json({ error: 'Utilizador existe mas não foi possível encontrar' }, { status: 500 })
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

  // 4. Upsert business_members
  const { data: existingMember } = await admin
    .from('business_members')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', newUserId)
    .maybeSingle()

  if (existingMember) {
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
      return NextResponse.json({ error: 'Erro business_members: ' + memberError.message }, { status: 500 })
    }
  }

  // 5. Upsert staff_profile (admin client bypasses RLS)
  const { data: existingProfile } = await admin
    .from('staff_profiles')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', newUserId)
    .maybeSingle()

  let staffId: string

  if (existingProfile) {
    staffId = existingProfile.id
    await admin.from('staff_profiles')
      .update({ name, email, is_active: true, bio: bio || null, color: color || COLORS[0] })
      .eq('id', staffId)
  } else {
    const { data: newProfile, error: profileError } = await admin
      .from('staff_profiles')
      .insert({
        business_id: businessId,
        user_id: newUserId,
        name,
        email,
        color: color || COLORS[(sortOrder || 0) % COLORS.length],
        bio: bio || null,
        is_active: true,
        sort_order: sortOrder || 0,
      })
      .select('id')
      .single()

    if (profileError || !newProfile) {
      return NextResponse.json({ error: 'Erro staff_profile: ' + (profileError?.message || 'unknown') }, { status: 500 })
    }
    staffId = newProfile.id
  }

  return NextResponse.json({ success: true, userId: newUserId, staffId, email, name, role })
}
