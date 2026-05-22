'use client'

import { useState, useRef } from 'react'
import {
  format,
  addWeeks,
  subWeeks,
  isToday,
  isWeekend,
} from 'date-fns'
import { getViewDays, calcUtilization, getAllocationStyle, hexToRgba, cn } from '@/lib/utils'
import { ROLES } from '@/components/ui/RoleSelect'
import MonthPicker from '@/components/ui/MonthPicker'
import PeopleFilter from '@/components/ui/PeopleFilter'
import type { AllocationWithProject, TeamMember, Project, TimeOff, ViewMode } from '@/lib/types'
import { TIME_OFF_LABELS } from '@/lib/types'
import AllocationModal from './AllocationModal'
import TimeOffModal from './TimeOffModal'

const DAY_WIDTH_MAP: Record<ViewMode, number> = {
  week: 52,
  '3weeks': 44,
  month: 36,
  quarter: 26,
}

const LANE_HEIGHT = 28   // px per allocation block
const LANE_GAP = 4       // px between lanes
const ROW_PADDING = 8    // px top + bottom

function calcRowHeight(numLanes: number) {
  return Math.max(56, ROW_PADDING * 2 + numLanes * LANE_HEIGHT + (numLanes - 1) * LANE_GAP)
}

function assignLanes(allocs: AllocationWithProject[]): (AllocationWithProject & { lane: number })[] {
  const sorted = [...allocs].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const laneEnds: string[] = []
  return sorted.map((alloc) => {
    let lane = laneEnds.findIndex((end) => alloc.start_date > end)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = alloc.end_date
    return { ...alloc, lane }
  })
}

// Combined item for lane assignment (allocation or time-off)
type LaneItem =
  | (AllocationWithProject & { lane: number; kind: 'allocation' })
  | (TimeOff & { lane: number; kind: 'timeoff' })

function assignLanesAll(
  allocs: AllocationWithProject[],
  offs: TimeOff[]
): LaneItem[] {
  type Raw = { start_date: string; end_date: string; kind: 'allocation' | 'timeoff'; data: AllocationWithProject | TimeOff }
  const items: Raw[] = [
    ...allocs.map((a) => ({ start_date: a.start_date, end_date: a.end_date, kind: 'allocation' as const, data: a })),
    ...offs.map((t) => ({ start_date: t.start_date, end_date: t.end_date, kind: 'timeoff' as const, data: t })),
  ].sort((a, b) => a.start_date.localeCompare(b.start_date))

  const laneEnds: string[] = []
  return items.map(({ kind, data }) => {
    let lane = laneEnds.findIndex((end) => data.start_date > end)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = data.end_date
    return kind === 'allocation'
      ? { ...(data as AllocationWithProject), lane, kind }
      : { ...(data as TimeOff), lane, kind }
  })
}

interface TimelineProps {
  people: TeamMember[]
  projects: Project[]
  allocations: AllocationWithProject[]
  timeOffs: TimeOff[]
  onRefresh: () => void
}

export default function Timeline({ people, projects, allocations, timeOffs, onRefresh }: TimelineProps) {
  const [anchor, setAnchor] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('3weeks')
  const [roleFilter, setRoleFilter] = useState<string | null>(null)
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([])
  const [modal, setModal] = useState<{
    open: boolean
    allocation?: AllocationWithProject | null
    defaultPersonId?: string
    defaultStartDate?: string
  }>({ open: false })
  const [oooModal, setOooModal] = useState<{
    open: boolean
    timeOff?: TimeOff | null
    defaultPersonId?: string
    defaultStartDate?: string
  }>({ open: false })
  const scrollRef = useRef<HTMLDivElement>(null)

  const days = getViewDays(anchor, viewMode)
  const DAY_WIDTH = DAY_WIDTH_MAP[viewMode]

  const filteredPeople = people.filter((p) => {
    const passRole = !roleFilter || p.role.split(',').map((r) => r.trim()).includes(roleFilter)
    const passPeople = selectedPeopleIds.length === 0 || selectedPeopleIds.includes(p.id)
    return passRole && passPeople
  })

  // Precompute lanes + row heights for each person (allocations + time offs combined)
  const rowData = filteredPeople.map((person) => {
    const personAllocs = allocations.filter((a) => a.person_id === person.id)
    const personOffs = timeOffs.filter((t) => t.person_id === person.id)
    const laned = assignLanesAll(personAllocs, personOffs)
    const numLanes = laned.length > 0 ? Math.max(...laned.map((a) => a.lane)) + 1 : 1
    const rowHeight = calcRowHeight(numLanes)
    return { person, laned, personAllocs, personOffs, numLanes, rowHeight }
  })

  function openCreate(personId: string, date: string) {
    setModal({ open: true, allocation: null, defaultPersonId: personId, defaultStartDate: date })
  }

  function openEdit(alloc: AllocationWithProject) {
    setModal({ open: true, allocation: alloc })
  }

  function openEditOoo(t: TimeOff) {
    setOooModal({ open: true, timeOff: t })
  }

  const stepWeeks = viewMode === 'week' ? 1 : viewMode === '3weeks' ? 3 : viewMode === 'month' ? 4 : 13

  function navigatePrev() {
    setAnchor((a) => subWeeks(a, stepWeeks))
  }

  function navigateNext() {
    setAnchor((a) => addWeeks(a, stepWeeks))
  }

  // Group days into months for header
  const monthGroups: { label: string; count: number }[] = []
  for (const day of days) {
    const label = format(day, 'MMMM yyyy')
    const last = monthGroups[monthGroups.length - 1]
    if (last?.label === label) last.count++
    else monthGroups.push({ label, count: 1 })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 h-14 border-b border-slate-800 bg-slate-950 shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            onClick={navigatePrev}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <button
            onClick={() => setAnchor(new Date())}
            className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition"
          >
            Dziś
          </button>
          <button
            onClick={navigateNext}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <MonthPicker anchor={anchor} onChange={setAnchor} />

        <PeopleFilter
          people={people}
          selected={selectedPeopleIds}
          onChange={setSelectedPeopleIds}
        />

        {/* Role filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setRoleFilter(null)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full transition',
              roleFilter === null
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
            )}
          >
            Wszyscy
          </button>
          {ROLES.map((role) => {
            const count = people.filter((p) =>
              p.role.split(',').map((r) => r.trim()).includes(role)
            ).length
            if (count === 0) return null
            return (
              <button
                key={role}
                onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-full transition',
                  roleFilter === role
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
                )}
              >
                {role} <span className="opacity-60">({count})</span>
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg">
            {(['week', '3weeks', 'month', 'quarter'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition',
                  viewMode === m ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                {m === 'week' ? 'Tydzień' : m === '3weeks' ? '3 tyg.' : m === 'month' ? 'Miesiąc' : 'Kwartał'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setOooModal({ open: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition"
            title="Dodaj nieobecność"
          >
            <span className="text-base leading-none">🏖️</span>
            OOO
          </button>

          <button
            onClick={() => setModal({ open: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Przydziel
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-56 shrink-0 border-r border-slate-800 overflow-y-auto overflow-x-hidden bg-slate-950">
          <div className="h-[56px] border-b border-slate-800 px-4 flex items-end pb-1">
            <span className="text-xs text-slate-500 font-medium">
              ZESPÓŁ {roleFilter && `· ${filteredPeople.length}`}
            </span>
          </div>
          {rowData.map(({ person, personAllocs, personOffs, rowHeight }) => {
            const util = calcUtilization(personAllocs, days, person.capacity_hours_per_day, personOffs)
            const { allocated, free, allocatedHours, capacityHours, ooodays } = util
            const barColor = allocated > 100 ? '#ef4444' : allocated > 85 ? '#f59e0b' : '#10b981'

            return (
              <div
                key={person.id}
                className="flex items-center px-4 border-b border-slate-800 gap-3"
                style={{ height: rowHeight }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                  style={{ backgroundColor: person.avatar_color ?? '#6366f1' }}
                >
                  {person.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate leading-tight">{person.full_name}</p>
                  <div className="mt-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-slate-500">{allocatedHours}h / {capacityHours}h</span>
                      <span className="text-[10px] font-medium" style={{ color: barColor }}
                        title={`${allocated}% zajęty · ${free}% wolny`}>
                        {free > 0 ? `${free}% wolny` : 'pełny'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(allocated, 100)}%`, backgroundColor: barColor }} />
                    </div>
                    {ooodays > 0 && (
                      <p className="text-[10px] text-slate-500 mt-0.5">🏖️ {ooodays} dni OOO</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {filteredPeople.length === 0 && roleFilter && (
            <div className="px-4 py-6 text-center text-xs text-slate-500">
              Brak osób z tym stanowiskiem
            </div>
          )}
        </div>

        {/* Right: timeline grid */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div
            className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800"
            style={{ width: days.length * DAY_WIDTH }}
          >
            {/* Month row */}
            <div className="flex h-7 border-b border-slate-800">
              {monthGroups.map(({ label, count }) => (
                <div
                  key={label}
                  className="flex items-center px-3 text-xs font-semibold text-slate-400 border-r border-slate-800"
                  style={{ width: count * DAY_WIDTH }}
                >
                  {label}
                </div>
              ))}
            </div>
            {/* Day row */}
            <div className="flex h-[29px]">
              {days.map((day) => {
                const weekend = isWeekend(day)
                const today = isToday(day)
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'flex flex-col items-center justify-center border-r border-slate-800 text-xs shrink-0',
                      weekend ? 'bg-slate-900' : '',
                      today ? 'bg-indigo-950' : ''
                    )}
                    style={{ width: DAY_WIDTH }}
                  >
                    <span className={cn('text-[10px]', weekend ? 'text-slate-600' : 'text-slate-500')}>
                      {format(day, 'EEE')[0]}
                    </span>
                    <span className={cn(
                      'text-[11px] font-medium leading-none',
                      today ? 'text-indigo-400 font-bold' : weekend ? 'text-slate-600' : 'text-slate-300'
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {rowData.map(({ person, laned, rowHeight }) => (
            <div
              key={person.id}
              className="relative border-b border-slate-800 flex"
              style={{ width: days.length * DAY_WIDTH, height: rowHeight }}
            >
              {/* Clickable day cells */}
              {days.map((day) => {
                const weekend = isWeekend(day)
                const today = isToday(day)
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => !weekend && openCreate(person.id, format(day, 'yyyy-MM-dd'))}
                    className={cn(
                      'h-full border-r border-slate-800 shrink-0',
                      weekend
                        ? 'bg-slate-900/50'
                        : today
                        ? 'bg-indigo-950/30 cursor-pointer hover:bg-indigo-950/50'
                        : 'cursor-pointer hover:bg-slate-800/40'
                    )}
                    style={{ width: DAY_WIDTH }}
                  />
                )
              })}

              {/* Allocation blocks — one per lane */}
              {laned.map((item) => {
                const { left, width, visible } = getAllocationStyle(item, days, DAY_WIDTH)
                if (!visible) return null
                const topOffset = ROW_PADDING + item.lane * (LANE_HEIGHT + LANE_GAP)

                // ── OOO block ──
                if (item.kind === 'timeoff') {
                  const { label, emoji } = TIME_OFF_LABELS[item.type]
                  return (
                    <div
                      key={`ooo-${item.id}`}
                      onClick={(e) => { e.stopPropagation(); openEditOoo(item) }}
                      className="absolute rounded cursor-pointer flex items-center px-2 gap-1 overflow-hidden hover:opacity-80 transition-opacity"
                      style={{
                        left, width, top: topOffset, height: LANE_HEIGHT,
                        background: `repeating-linear-gradient(45deg, #1e293b, #1e293b 4px, #253047 4px, #253047 8px)`,
                        borderLeft: '3px solid #475569',
                      }}
                      title={`${label} · ${item.notes ?? ''}`}
                    >
                      <span className="text-sm leading-none">{emoji}</span>
                      <span className="text-[11px] font-medium text-slate-300 truncate leading-none">{label}</span>
                    </div>
                  )
                }

                // ── Allocation block ──
                const project = item.project
                const bg = project?.color ?? '#6366f1'
                const isTentative = item.status === 'tentative'

                return (
                  <div
                    key={`alloc-${item.id}`}
                    onClick={(e) => { e.stopPropagation(); openEdit(item) }}
                    className="absolute rounded cursor-pointer flex items-center px-2 overflow-hidden hover:opacity-90 transition-opacity"
                    style={{
                      left, width, top: topOffset, height: LANE_HEIGHT,
                      background: isTentative
                        ? `repeating-linear-gradient(45deg,${hexToRgba(bg,0.12)},${hexToRgba(bg,0.12)} 4px,${hexToRgba(bg,0.28)} 4px,${hexToRgba(bg,0.28)} 8px)`
                        : hexToRgba(bg, 0.25),
                      borderLeft: `3px solid ${bg}`,
                      borderStyle: isTentative ? 'dashed' : 'solid',
                      opacity: isTentative ? 0.85 : 1,
                    }}
                    title={`${project?.name} — ${item.hours_per_day}h/dzień · ${isTentative ? 'Tentative' : 'Confirmed'}`}
                  >
                    <span className="text-xs font-medium truncate leading-none" style={{ color: bg }}>
                      {project?.name}
                    </span>
                    <div className="ml-auto flex items-center gap-1 shrink-0">
                      {isTentative && (
                        <span className="text-[9px] font-bold leading-none" style={{ color: bg, opacity: 0.8 }}>?</span>
                      )}
                      <span className="text-[10px] opacity-70 leading-none" style={{ color: bg }}>
                        {item.hours_per_day}h
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <AllocationModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        onSaved={onRefresh}
        allocation={modal.allocation}
        defaultPersonId={modal.defaultPersonId}
        defaultStartDate={modal.defaultStartDate}
        people={people}
        projects={projects}
      />

      <TimeOffModal
        open={oooModal.open}
        onClose={() => setOooModal({ open: false })}
        onSaved={onRefresh}
        timeOff={oooModal.timeOff}
        defaultPersonId={oooModal.defaultPersonId}
        defaultStartDate={oooModal.defaultStartDate}
        people={people}
      />
    </div>
  )
}
