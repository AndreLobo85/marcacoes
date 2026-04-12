import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

/**
 * POST /api/internal/invite — Create an invite token for a team member.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { businessId, email, role } = body as { businessId: string; email: string; role: string }

  if (!businessId || !email || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify user is owner of this business
  const { data: member } = await supabase
    .from('business_members')
    .select('role')
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can invite members' }, { status: 403 })
  }

  // Check if already a member
  const { data: existingInvite } = await supabase
    .from('invite_tokens')
    .select('id')
    .eq('business_id', businessId)
    .eq('email', email)
    .is('accepted_at', null)
    .single()

  if (existingInvite) {
    return NextResponse.json({ error: 'Já existe um convite pendente para este email' }, { status: 400 })
  }

  // Generate unique token
  const token = randomBytes(32).toString('hex')

  const { error } = await supabase.from('invite_tokens').insert({
    business_id: businessId,
    email,
    role,
    token,
    invited_by: user.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Build invite URL
  const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''
  const inviteUrl = `${baseUrl}/invite/${token}`

  return NextResponse.json({
    token,
    inviteUrl,
    email,
    role,
  })
}
