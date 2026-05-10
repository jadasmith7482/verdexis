import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Dot } from 'lucide-react'
import Navigation from '../components/Navigation'

interface CalEvent {
  date: string // YYYY-MM-DD
  time: string
  title: string
  importance: 'high' | 'medium' | 'low'
  forecast?: string
  previous?: string
  category: 'crypto' | 'macro' | 'earnings' | 'fed'
}

const EVENTS: CalEvent[] = [
  { date: '2026-05-12', time: '08:30', title: 'US CPI (Apr)', importance: 'high', forecast: '3.1%', previous: '3.5%', category: 'macro' },
  { date: '2026-05-12', time: '10:00', title: 'Bitcoin Halving Countdown Update', importance: 'medium', category: 'crypto' },
  { date: '2026-05-13', time: '14:00', title: 'FOMC Meeting Minutes', importance: 'high', forecast: 'N/A', previous: 'N/A', category: 'fed' },
  { date: '2026-05-14', time: '08:30', title: 'US PPI (Apr)', importance: 'medium', forecast: '2.8%', previous: '3.1%', category: 'macro' },
  { date: '2026-05-14', time: '09:00', title: 'Ethereum ETF Staking Approval Deadline', importance: 'high', category: 'crypto' },
  { date: '2026-05-15', time: '09:30', title: 'US Retail Sales (Apr)', importance: 'high', forecast: '+0.4%', previous: '-0.1%', category: 'macro' },
  { date: '2026-05-15', time: 'All Day', title: 'Coinbase Quarterly Earnings', importance: 'high', category: 'earnings' },
  { date: '2026-05-16', time: '11:00', title: 'Bitcoin Options Expiry ($3.2B)', importance: 'high', category: 'crypto' },
  { date: '2026-05-19', time: '08:30', title: 'US Housing Starts (Apr)', importance: 'low', forecast: '1.42M', previous: '1.39M', category: 'macro' },
  { date: '2026-05-20', time: '14:00', title: 'Fed Chair Powell Speech', importance: 'high', category: 'fed' },
  { date: '2026-05-20', time: 'All Day', title: 'Crypto Summit — Singapore', importance: 'medium', category: 'crypto' },
  { date: '2026-05-21', time: '08:30', title: 'US Jobless Claims', importance: 'medium', forecast: '215K', previous: '228K', category: 'macro' },
  { date: '2026-05-22', time: 'All Day', title: 'MicroStrategy Earnings', importance: 'medium', category: 'earnings' },
  { date: '2026-05-27', time: '09:00', title: 'SEC Crypto Hearing', importance: 'high', category: 'crypto' },
  { date: '2026-05-28', time: '08:30', title: 'US GDP (Q1 Final)', importance: 'high', forecast: '2.3%', previous: '2.1%', category: 'macro' },
  { date: '2026-05-30', time: '20:00', title: 'Ethereum Network Upgrade Vote', importance: 'medium', category: 'crypto' },
]

const IMPORTANCE_COLOR: Record<string, string> = {
  high: 'text-red-400 bg-red-400/10',
  medium: 'text-yellow-400 bg-yellow-400/10',
  low: 'text-[#0C8B44] bg-[#0C8B44]/10',
}

const CATEGORY_COLOR: Record<string, string> = {
  crypto: 'text-purple-400',
  macro: 'text-blue-400',
  earnings: 'text-yellow-400',
  fed: 'text-red-400',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function EconomicCalendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [filter, setFilter] = useState<'all' | 'crypto' | 'macro' | 'earnings' | 'fed'>('all')
  const [importanceFilter, setImportanceFilter] = useState<'all' | 'high'>('all')

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const visibleEvents = EVENTS.filter(e => {
    const d = new Date(e.date)
    if (d.getFullYear() !== year || d.getMonth() !== month) return false
    if (filter !== 'all' && e.category !== filter) return false
    if (importanceFilter === 'high' && e.importance !== 'high') return false
    return true
  })

  const eventsByDay: Record<number, CalEvent[]> = {}
  visibleEvents.forEach(e => {
    const day = parseInt(e.date.split('-')[2])
    if (!eventsByDay[day]) eventsByDay[day] = []
    eventsByDay[day].push(e)
  })

  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : []

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">Economic Calendar</h1>
              <p className="text-xs text-[#737373]">Key macro events, crypto catalysts & earnings.</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {(['all', 'crypto', 'macro', 'earnings', 'fed'] as const).map(cat => (
              <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 rounded-full text-xs transition-colors ${filter === cat ? 'bg-[#0C8B44] text-white' : 'bg-[#0f1619] border border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'}`}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
            <button onClick={() => setImportanceFilter(i => i === 'all' ? 'high' : 'all')} className={`ml-auto px-3 py-1.5 rounded-full text-xs transition-colors ${importanceFilter === 'high' ? 'bg-red-600 text-white' : 'bg-[#0f1619] border border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'}`}>
              High Impact Only
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Calendar Grid */}
            <div className="lg:col-span-2 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[#ffffff08] transition-colors"><ChevronLeft className="w-4 h-4 text-[#737373]" /></button>
                <h2 className="text-sm font-medium text-[#E5E5E5]">{MONTHS[month]} {year}</h2>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[#ffffff08] transition-colors"><ChevronRight className="w-4 h-4 text-[#737373]" /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map(d => <div key={d} className="text-center text-[10px] text-[#737373] py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const hasEvents = !!eventsByDay[day]
                  const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                  const isSelected = day === selectedDay
                  const hasHigh = eventsByDay[day]?.some(e => e.importance === 'high')
                  return (
                    <button key={day} onClick={() => setSelectedDay(day)} className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center relative transition-colors ${isSelected ? 'bg-[#0C8B44] text-white' : isToday ? 'border border-[#0C8B44] text-[#0C8B44]' : 'hover:bg-[#ffffff08] text-[#737373]'}`}>
                      {day}
                      {hasEvents && !isSelected && (
                        <div className={`w-1 h-1 rounded-full mt-0.5 ${hasHigh ? 'bg-red-400' : 'bg-[#0C8B44]'}`} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Day Events */}
            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">
                {selectedDay ? `${MONTHS[month]} ${selectedDay}` : 'Select a day'}
              </h2>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-[#737373] text-center py-8">No events on this day.</p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((ev, i) => (
                    <div key={i} className="rounded-xl bg-[#0a0f11] border border-[#ffffff08] p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs text-[#E5E5E5] font-medium leading-tight">{ev.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${IMPORTANCE_COLOR[ev.importance]}`}>{ev.importance}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-[#737373]">
                        <span className={CATEGORY_COLOR[ev.category]}>{ev.category}</span>
                        <span>{ev.time}</span>
                      </div>
                      {(ev.forecast || ev.previous) && (
                        <div className="flex gap-4 mt-2 text-[10px]">
                          {ev.forecast && <span className="text-[#737373]">Forecast: <span className="text-[#E5E5E5]">{ev.forecast}</span></span>}
                          {ev.previous && <span className="text-[#737373]">Prior: <span className="text-[#E5E5E5]">{ev.previous}</span></span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming high-impact list */}
          <div className="mt-6 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">All Events This Month</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#737373] text-left border-b border-[#ffffff08]">
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Time</th>
                    <th className="pb-3 pr-4 font-medium">Event</th>
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    <th className="pb-3 pr-4 font-medium">Impact</th>
                    <th className="pb-3 pr-4 font-medium">Forecast</th>
                    <th className="pb-3 font-medium">Previous</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ffffff05]">
                  {visibleEvents.map((ev, i) => (
                    <tr key={i} className="hover:bg-[#ffffff04] transition-colors">
                      <td className="py-2.5 pr-4 text-[#E5E5E5]">{ev.date.slice(5)}</td>
                      <td className="py-2.5 pr-4 text-[#737373]">{ev.time}</td>
                      <td className="py-2.5 pr-4 text-[#E5E5E5]">{ev.title}</td>
                      <td className={`py-2.5 pr-4 ${CATEGORY_COLOR[ev.category]}`}>{ev.category}</td>
                      <td className="py-2.5 pr-4"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${IMPORTANCE_COLOR[ev.importance]}`}>{ev.importance}</span></td>
                      <td className="py-2.5 pr-4 text-[#737373]">{ev.forecast ?? '—'}</td>
                      <td className="py-2.5 text-[#737373]">{ev.previous ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
