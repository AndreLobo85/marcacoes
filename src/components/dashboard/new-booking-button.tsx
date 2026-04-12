'use client'

import { useState } from 'react'
import type { Business } from '@/types/database'
import { CalendarCheck, Bell } from 'lucide-react'
import { NewBookingDialog } from './new-booking-dialog'
import { useRouter } from 'next/navigation'

interface NewBookingButtonProps {
  business: Business
  variant?: 'dark-card' | 'button'
}

export function NewBookingButton({ business, variant = 'dark-card' }: NewBookingButtonProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleCreated() {
    router.refresh()
  }

  if (variant === 'dark-card') {
    return (
      <>
        <div className="space-y-2.5">
          <button
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent hover:bg-[#D4B87A] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            Add New Booking
          </button>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-600 hover:border-stone-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-stone-300 transition-colors"
          >
            <Bell className="h-3.5 w-3.5" />
            Send Reminders
          </button>
        </div>

        <NewBookingDialog
          open={open}
          onOpenChange={setOpen}
          business={business}
          onCreated={handleCreated}
        />
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-accent hover:bg-[#D4B87A] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-colors"
      >
        <CalendarCheck className="h-3.5 w-3.5" />
        Nova Marcação
      </button>

      <NewBookingDialog
        open={open}
        onOpenChange={setOpen}
        business={business}
        onCreated={handleCreated}
      />
    </>
  )
}
