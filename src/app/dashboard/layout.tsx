import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getUserBusiness } from '@/lib/get-user-business'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Super admins must explicitly select a business before entering dashboard
  const { data: adminCheck } = await supabase.from('super_admins').select('id').eq('user_id', user.id).single()
  if (adminCheck) {
    const cookieStore = await cookies()
    const hasSelection = !!cookieStore.get('selected_business_id')?.value
    if (!hasSelection) redirect('/select-business')
  }

  const business = await getUserBusiness(supabase)

  return (
    <DashboardShell user={user} business={business}>
      {children}
    </DashboardShell>
  )
}
