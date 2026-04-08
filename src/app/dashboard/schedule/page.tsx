'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Professional, WorkingHours, Break as BreakType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, Save } from 'lucide-react'
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
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

interface BreakRow {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
  label: string
}

export default function SchedulePage() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [selectedProfId, setSelectedProfId] = useState<string>('')
  const [businessId, setBusinessId] = useState<string>('')
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [breaks, setBreaks] = useState<BreakRow[]>([])
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const loadProfessionals = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .single()
    if (!biz) return
    setBusinessId(biz.id)

    const { data } = await supabase
      .from('professionals')
      .select('*')
      .eq('business_id', biz.id)
      .eq('is_active', true)
      .order('sort_order')

    setProfessionals(data || [])
    if (data && data.length > 0 && !selectedProfId) {
      setSelectedProfId(data[0].id)
    }
  }, [supabase, selectedProfId])

  const loadSchedule = useCallback(async () => {
    if (!selectedProfId) return

    const [{ data: wh }, { data: br }] = await Promise.all([
      supabase.from('working_hours').select('*').eq('professional_id', selectedProfId).order('day_of_week'),
      supabase.from('breaks').select('*').eq('professional_id', selectedProfId).order('day_of_week'),
    ])

    if (wh && wh.length > 0) {
      setSchedule(wh.map(h => ({
        id: h.id,
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time,
        is_active: h.is_active,
      })))
    } else {
      // Default schedule: Mon-Fri 09:00-18:00
      setSchedule(DAYS.filter(d => d.value >= 1 && d.value <= 5).map(d => ({
        day_of_week: d.value,
        start_time: '09:00',
        end_time: '18:00',
        is_active: true,
      })))
    }

    setBreaks((br || []).map(b => ({
      id: b.id,
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
      label: b.label || '',
    })))
  }, [supabase, selectedProfId])

  useEffect(() => { loadProfessionals() }, [loadProfessionals])
  useEffect(() => { loadSchedule() }, [loadSchedule])

  function updateScheduleRow(index: number, field: keyof ScheduleRow, value: string | boolean | number) {
    setSchedule(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  function addBreak() {
    setBreaks(prev => [...prev, { day_of_week: 1, start_time: '12:00', end_time: '13:00', label: 'Almoço' }])
  }

  function removeBreak(index: number) {
    setBreaks(prev => prev.filter((_, i) => i !== index))
  }

  function updateBreak(index: number, field: keyof BreakRow, value: string | number) {
    setBreaks(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  async function handleSave() {
    if (!selectedProfId || !businessId) return
    setSaving(true)

    // Delete existing and re-insert
    await Promise.all([
      supabase.from('working_hours').delete().eq('professional_id', selectedProfId),
      supabase.from('breaks').delete().eq('professional_id', selectedProfId),
    ])

    const whInsert = schedule.map(row => ({
      professional_id: selectedProfId,
      business_id: businessId,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      is_active: row.is_active,
    }))

    const brInsert = breaks.map(row => ({
      professional_id: selectedProfId,
      business_id: businessId,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      label: row.label || null,
    }))

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('working_hours').insert(whInsert),
      breaks.length > 0 ? supabase.from('breaks').insert(brInsert) : Promise.resolve({ error: null }),
    ])

    if (e1 || e2) {
      toast.error('Erro ao guardar horários')
    } else {
      toast.success('Horários guardados')
    }

    setSaving(false)
    loadSchedule()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Horários</h1>
          <p className="text-muted-foreground">Define os horários de trabalho e pausas</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'A guardar...' : 'Guardar'}
        </Button>
      </div>

      {professionals.length > 1 && (
        <Select value={selectedProfId} onValueChange={(v) => v && setSelectedProfId(v)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Seleciona profissional" />
          </SelectTrigger>
          <SelectContent>
            {professionals.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Horário de Trabalho</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((day) => {
            const rowIndex = schedule.findIndex(r => r.day_of_week === day.value)
            const row = rowIndex >= 0 ? schedule[rowIndex] : null

            return (
              <div key={day.value} className="flex items-center gap-4">
                <div className="w-24">
                  <Switch
                    checked={row?.is_active ?? false}
                    onCheckedChange={(checked) => {
                      if (row && rowIndex >= 0) {
                        updateScheduleRow(rowIndex, 'is_active', checked)
                      } else {
                        setSchedule(prev => [...prev, {
                          day_of_week: day.value,
                          start_time: '09:00',
                          end_time: '18:00',
                          is_active: checked,
                        }])
                      }
                    }}
                  />
                </div>
                <span className="w-20 text-sm font-medium">{day.label}</span>
                {row?.is_active ? (
                  <>
                    <Input
                      type="time"
                      className="w-32"
                      value={row.start_time}
                      onChange={(e) => updateScheduleRow(rowIndex, 'start_time', e.target.value)}
                    />
                    <span className="text-muted-foreground">—</span>
                    <Input
                      type="time"
                      className="w-32"
                      value={row.end_time}
                      onChange={(e) => updateScheduleRow(rowIndex, 'end_time', e.target.value)}
                    />
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Fechado</span>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pausas</CardTitle>
          <Button variant="outline" size="sm" onClick={addBreak}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Pausa
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {breaks.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem pausas definidas.</p>
          )}
          {breaks.map((b, i) => (
            <div key={i} className="flex items-center gap-3">
              <Select
                value={String(b.day_of_week)}
                onValueChange={(v) => v && updateBreak(i, 'day_of_week', parseInt(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map(d => (
                    <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                className="w-28"
                value={b.start_time}
                onChange={(e) => updateBreak(i, 'start_time', e.target.value)}
              />
              <span className="text-muted-foreground">—</span>
              <Input
                type="time"
                className="w-28"
                value={b.end_time}
                onChange={(e) => updateBreak(i, 'end_time', e.target.value)}
              />
              <Input
                className="w-28"
                placeholder="Almoço"
                value={b.label}
                onChange={(e) => updateBreak(i, 'label', e.target.value)}
              />
              <Button variant="ghost" size="icon" onClick={() => removeBreak(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
