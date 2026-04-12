import { redirect } from 'next/navigation'
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

  const business = await getUserBusiness(supabase)

  return (
    <DashboardShell user={user} business={business}>
      {children}
    </DashboardShell>
  )
}
