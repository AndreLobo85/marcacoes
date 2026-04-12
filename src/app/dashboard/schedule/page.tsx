'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { StaffProfile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Save, Clock } from 'lucide-react'
import { toast } from 'sonner'

const DAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

interface ScheduleRow {
  day_of_week: number
  start_time: string
  end_time: string
  break_start: string
  break_end: string
  has_break: boolean
  is_active: boolean
}

export default function SchedulePage() {
  const [staffList, setStaffList] = useState<StaffProfile[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [businessId, setBusinessId] = useState<string>('')
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const loadStaff = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', user.id).single()
    if (!biz) return
    setBusinessId(biz.id)

    const { data } = await supabase.from('staff_profiles').select('*').eq('business_id', biz.id).eq('is_active', true).order('sort_order')
    setStaffList(data || [])
    if (data && data.length > 0 && !selectedStaffId) setSelectedStaffId(data[0].id)
  }, [supabase, selectedStaffId])

  const loadSchedule = useCallback(async () => {
    if (!selectedStaffId) return

    const { data: wh } = await supabase.from('staff_working_hours').select('*').eq('staff_id', selectedStaffId).order('day_of_week')

    if (wh && wh.length > 0) {
      setSchedule(wh.map((h) => ({
        day_of_week: h.day_of_week, start_time: h.start_time, end_time: h.end_time,
        break_start: h.break_start || '12:00', break_end: h.break_end || '13:00',
        has_break: !!(h.break_start && h.break_end), is_active: h.is_active,
      })))
    } else {
      setSchedule(DAYS.map((d) => ({
        day_of_week: d.value, start_time: '09:00', end_time: '18:00',
        break_start: '12:00', break_end: '13:00',
        has_break: d.value >= 1 && d.value <= 5, is_active: d.value >= 1 && d.value <= 5,
      })))
    }
  }, [supabase, selectedStaffId])

  useEffect(() => { loadStaff() }, [loadStaff])
  useEffect(() => { loadSchedule() }, [loadSchedule])

  function updateRow(dayValue: number, field: keyof ScheduleRow, value: string | boolean) {
    setSchedule((prev) => prev.map((row) => row.day_of_week === dayValue ? { ...row, [field]: value } : row))
  }

  async function handleSave() {
    if (!selectedStaffId || !businessId) return
    setSaving(true)

    await supabase.from('staff_working_hours').delete().eq('staff_id', selectedStaffId)

    const inserts = schedule.map((row) => ({
      staff_id: selectedStaffId, business_id: businessId, day_of_week: row.day_of_week,
      start_time: row.start_time, end_time: row.end_time,
      break_start: row.has_break ? row.break_start : null,
      break_end: row.has_break ? row.break_end : null, is_active: row.is_active,
    }))

    const { error } = await supabase.from('staff_working_hours').insert(inserts)
    if (error) { toast.error('Erro ao guardar') } else { toast.success('Horários guardados') }
    setSaving(false)
    loadSchedule()
  }

  const selected = staffList.find((s) => s.id === selectedStaffId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Working Hours</h1>
          <p className="text-sm text-muted-foreground mt-1">Define work schedules and breaks for each staff member.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 uppercase tracking-wider text-xs">
          <Save className="h-4 w-4" />
          {saving ? 'A guardar...' : 'Guardar'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Staff list */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">
            Select Staff
          </p>
          <div className="space-y-2">
            {staffList.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all ${
                  selectedStaffId === p.id ? 'border-accent/40 shadow-md' : 'hover:shadow-sm'
                }`}
                onClick={() => setSelectedStaffId(p.id)}
              >
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <Avatar className="h-9 w-9 border border-border">
                    {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.name} className="object-cover" /> : null}
                    <AvatarFallback style={{ backgroundColor: p.color, color: 'white' }} className="text-[10px] font-semibold">
                      {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-accent font-medium">{p.bio || 'Staff'}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Schedule editor */}
        {selected && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Weekly Schedule</p>
                  <p className="text-xs text-muted-foreground">{selected.name}</p>
                </div>
              </div>

              <div className="space-y-3">
                {DAYS.map((day) => {
                  const row = schedule.find((r) => r.day_of_week === day.value)
                  if (!row) return null

                  return (
                    <div key={day.value} className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={row.is_active}
                          onCheckedChange={(checked) => updateRow(day.value, 'is_active', checked)}
                        />
                        <span className="w-20 text-sm font-semibold">{day.label}</span>
                        {row.is_active ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input type="time" className="w-28 h-8 text-xs bg-background" value={row.start_time}
                              onChange={(e) => updateRow(day.value, 'start_time', e.target.value)} />
                            <span className="text-muted-foreground text-xs">—</span>
                            <Input type="time" className="w-28 h-8 text-xs bg-background" value={row.end_time}
                              onChange={(e) => updateRow(day.value, 'end_time', e.target.value)} />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Fechado</span>
                        )}
                      </div>

                      {row.is_active && (
                        <div className="flex items-center gap-4 mt-2 ml-14">
                          <Switch
                            checked={row.has_break}
                            onCheckedChange={(checked) => updateRow(day.value, 'has_break', checked)}
                          />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-16">Pausa</span>
                          {row.has_break && (
                            <div className="flex items-center gap-2">
                              <Input type="time" className="w-24 h-7 text-[11px] bg-background" value={row.break_start}
                                onChange={(e) => updateRow(day.value, 'break_start', e.target.value)} />
                              <span className="text-muted-foreground text-xs">—</span>
                              <Input type="time" className="w-24 h-7 text-[11px] bg-background" value={row.break_end}
                                onChange={(e) => updateRow(day.value, 'break_end', e.target.value)} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
