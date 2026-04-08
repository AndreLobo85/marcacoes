import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import type { Business } from '@/types/database'

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

  // Get user's business
  const { data } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  const business = data as Business | null

  return (
    <DashboardShell user={user} business={business}>
      {children}
    </DashboardShell>
  )
}
