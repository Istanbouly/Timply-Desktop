import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import {
  ChevronLeft, ChevronRight, CalendarDays, RefreshCw,
  LogOut, X
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────
const SLOT_MINS       = 30;
const ROW_HEIGHT      = 48;
const TIME_COL_W      = 60;
const GRID_START      = 7 * 60;
const GRID_END        = 21 * 60;
const MAX_STAFF_COLS  = 5;

// ── Date helpers ──────────────────────────────────────────────────
function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function isToday(date) { return toDateStr(date) === toDateStr(new Date()); }
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}
function getWeekDays(date) {
  const monday = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateStr(d);
  });
}
function formatHeading(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function formatWeekHeading(date) {
  const monday = getWeekStart(date);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
function formatMonthHeading(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function timeToMins(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function getService(b) {
  return b.event_types?.name
    || b.booking_event_types?.map(x => x.event_types?.name).filter(Boolean).join(' + ')
    || 'Appointment';
}

const AVATAR_COLORS = ['bg-violet-500','bg-sky-500','bg-teal-500','bg-rose-500','bg-amber-500','bg-indigo-500'];
function avatarColor(name = '') {
  let s = 0; for (const c of name) s += c.charCodeAt(0);
  return AVATAR_COLORS[s % AVATAR_COLORS.length];
}

// ── Status styles ─────────────────────────────────────────────────
const STATUS_BLOCK = {
  confirmed: 'bg-emerald-50 border-emerald-500 text-emerald-900',
  pending:   'bg-amber-50 border-amber-400 text-amber-900',
  cancelled: 'bg-stone-100 border-stone-300 text-stone-400 opacity-50',
  no_show:   'bg-rose-50 border-rose-300 text-rose-700 opacity-60',
  completed: 'bg-slate-50 border-slate-300 text-slate-600',
};
const STATUS_BADGE = {
  confirmed: 'text-emerald-700 bg-emerald-50',
  pending:   'text-amber-700 bg-amber-100',
  cancelled: 'text-stone-500 bg-stone-100',
  no_show:   'text-rose-600 bg-rose-50',
  completed: 'text-slate-600 bg-slate-100',
};
const STATUS_LABEL = { confirmed: 'Confirmed', pending: 'Pending', cancelled: 'Cancelled', no_show: 'No Show', completed: 'Completed' };

// ── Booking block ─────────────────────────────────────────────────
function BookingBlock({ booking, selected, onSelect }) {
  const startMins  = timeToMins(booking.start_time);
  const endMins    = booking.end_time ? timeToMins(booking.end_time) : startMins + (booking.event_types?.duration_minutes || 60);
  const bufferMins = booking.event_types?.buffer_minutes || booking.booking_event_types?.[0]?.event_types?.buffer_minutes || 0;

  const topPx     = ((startMins - GRID_START) / SLOT_MINS) * ROW_HEIGHT;
  const servicePx = Math.max(((endMins - startMins) / SLOT_MINS) * ROW_HEIGHT, ROW_HEIGHT / 2);
  const bufferPx  = (bufferMins / SLOT_MINS) * ROW_HEIGHT;
  const colorCls  = STATUS_BLOCK[booking.status] || STATUS_BLOCK.confirmed;
  const isSelected = selected?.id === booking.id;

  return (
    <div
      className="absolute left-1 right-1"
      style={{ top: topPx, height: servicePx + bufferPx, zIndex: isSelected ? 5 : 1 }}
      onClick={(e) => { e.stopPropagation(); onSelect(booking); }}
    >
      <div
        className={`rounded-md border-l-2 px-1.5 py-1 cursor-pointer transition-all overflow-hidden select-none ${colorCls} ${isSelected ? 'ring-2 ring-stone-900 ring-offset-1' : 'hover:brightness-95'}`}
        style={{ height: servicePx }}
      >
        <p className="text-[10px] font-semibold leading-tight truncate">{getService(booking)}</p>
        {servicePx >= ROW_HEIGHT && (
          <p className="text-[9px] leading-tight truncate opacity-70 mt-0.5">{booking.caller_name || '—'}</p>
        )}
        {servicePx >= ROW_HEIGHT * 1.5 && (
          <p className="text-[9px] leading-tight opacity-60 mt-0.5">
            {formatTime(booking.start_time)}{booking.end_time ? ` – ${formatTime(booking.end_time)}` : ''}
          </p>
        )}
      </div>
      {bufferPx > 0 && (
        <div className="border-l-2 border-dashed border-stone-300 bg-stone-50 opacity-70 flex items-center px-1.5" style={{ height: bufferPx }}>
          <p className="text-[9px] text-stone-400 font-medium">{bufferMins}m buffer</p>
        </div>
      )}
    </div>
  );
}

// ── Now indicator ─────────────────────────────────────────────────
function NowIndicator() {
  const [top, setTop] = useState(null);
  useEffect(() => {
    function calc() {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      setTop(mins >= GRID_START && mins <= GRID_END ? ((mins - GRID_START) / SLOT_MINS) * ROW_HEIGHT : null);
    }
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, []);
  if (top === null) return null;
  return (
    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-[#C9A96E] shrink-0 -ml-1" />
        <div className="flex-1 border-t-2 border-[#C9A96E]" />
      </div>
    </div>
  );
}

// ── Staff day grid ────────────────────────────────────────────────
function StaffDayGrid({ columns, bookings, selected, onSelectBooking, staffPage, setStaffPage }) {
  const [hoverSlot, setHoverSlot] = useState(null);
  const bodyRef = useRef(null);
  const todayStr = toDateStr(new Date());

  const totalPages = Math.ceil(columns.length / MAX_STAFF_COLS);
  const visibleCols = columns.slice(staffPage * MAX_STAFF_COLS, (staffPage + 1) * MAX_STAFF_COLS);

  const totalSlots = (GRID_END - GRID_START) / SLOT_MINS;
  const gridHeight = totalSlots * ROW_HEIGHT;
  const TIME_LABELS = Array.from({ length: totalSlots }, (_, i) => {
    const mins = GRID_START + i * SLOT_MINS;
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  });

  const byUser = {};
  for (const b of bookings) {
    if (!byUser[b.user_id]) byUser[b.user_id] = [];
    byUser[b.user_id].push(b);
  }

  function handleMouseMove(e) {
    if (!bodyRef.current) return;
    const rect = bodyRef.current.getBoundingClientRect();
    const slotIndex = Math.floor((e.clientY - rect.top) / ROW_HEIGHT);
    const mins = GRID_START + slotIndex * SLOT_MINS;
    if (mins >= GRID_START && mins < GRID_END) {
      const h = Math.floor(mins / 60), m = mins % 60;
      setHoverSlot({ y: slotIndex * ROW_HEIGHT, label: `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` });
    } else setHoverSlot(null);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden border border-stone-200 rounded-xl bg-white">

      {/* Sticky header */}
      <div className="sticky top-0 z-20 flex bg-white border-b border-stone-200 shrink-0">
        {/* Time col + pagination */}
        <div style={{ minWidth: TIME_COL_W, width: TIME_COL_W }} className="shrink-0 flex items-center justify-center gap-0.5 px-1">
          {totalPages > 1 && (
            <>
              <button
                onClick={() => setStaffPage(p => Math.max(0, p - 1))}
                disabled={staffPage === 0}
                className="p-0.5 rounded text-stone-400 hover:text-stone-700 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={12} />
              </button>
              <button
                onClick={() => setStaffPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={staffPage === totalPages - 1}
                className="p-0.5 rounded text-stone-400 hover:text-stone-700 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={12} />
              </button>
            </>
          )}
        </div>

        {visibleCols.map(col => (
          <div key={col.id} className="flex-1 min-w-0 flex flex-col items-center justify-center py-2.5 border-l border-stone-100 gap-1 px-2">
            {col.avatar_url
              ? <img src={col.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
              : (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 ${avatarColor(col.name)}`}>
                  {getInitials(col.name)}
                </div>
              )
            }
            <div className="text-center min-w-0 w-full">
              <p className="text-xs font-semibold text-stone-800 leading-none truncate">{col.name}</p>
              {col.isOwner && <p className="text-[10px] text-[#C9A96E] leading-none mt-0.5">Owner</p>}
            </div>
          </div>
        ))}

        {/* Page indicator */}
        {totalPages > 1 && (
          <div className="flex items-center px-2 border-l border-stone-100 shrink-0">
            <span className="text-[10px] text-stone-400">{staffPage + 1}/{totalPages}</span>
          </div>
        )}
      </div>

      {/* Scrollable grid body */}
      <div className="flex-1 overflow-auto">
        <div
          ref={bodyRef}
          className="flex relative"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverSlot(null)}
        >
          {hoverSlot && (
            <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: hoverSlot.y }}>
              <div className="absolute inset-x-0 border-t border-dashed border-stone-400" style={{ left: TIME_COL_W }} />
              <span className="absolute -translate-y-1/2 bg-stone-700 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap" style={{ left: TIME_COL_W + 4 }}>
                {hoverSlot.label}
              </span>
            </div>
          )}

          {/* Time labels */}
          <div style={{ minWidth: TIME_COL_W, width: TIME_COL_W, height: gridHeight }} className="shrink-0 relative">
            {TIME_LABELS.map((label, i) => label.endsWith(':00') && (
              <div key={label} className="absolute right-0 pr-2 flex items-start" style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}>
                <span className="text-[10px] text-stone-400 font-medium leading-none pt-0.5">{formatTime(label)}</span>
              </div>
            ))}
          </div>

          {/* Staff columns */}
          {visibleCols.map(col => {
            const colBookings = (byUser[col.id] || []).filter(b => {
              const s = timeToMins(b.start_time);
              const e = b.end_time ? timeToMins(b.end_time) : s + 60;
              return e > GRID_START && s < GRID_END;
            });
            return (
              <div key={col.id} className="flex-1 min-w-0 border-l border-stone-100 relative" style={{ height: gridHeight }}>
                {TIME_LABELS.map((label, i) => (
                  <div key={label} className={`absolute left-0 right-0 ${label.endsWith(':00') ? 'border-t border-stone-200' : 'border-t border-stone-100'}`} style={{ top: i * ROW_HEIGHT }} />
                ))}
                {col.isToday && <NowIndicator />}
                {colBookings.map(b => (
                  <BookingBlock key={b.id} booking={b} selected={selected} onSelect={onSelectBooking} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Week grid ─────────────────────────────────────────────────────
function WeekGrid({ days, bookings, selected, onSelectBooking }) {
  const [hoverSlot, setHoverSlot] = useState(null);
  const bodyRef = useRef(null);
  const todayStr = toDateStr(new Date());

  const totalSlots = (GRID_END - GRID_START) / SLOT_MINS;
  const gridHeight = totalSlots * ROW_HEIGHT;
  const TIME_LABELS = Array.from({ length: totalSlots }, (_, i) => {
    const mins = GRID_START + i * SLOT_MINS;
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  });

  const byDate = {};
  for (const b of bookings) {
    if (!byDate[b.date]) byDate[b.date] = [];
    byDate[b.date].push(b);
  }

  function handleMouseMove(e) {
    if (!bodyRef.current) return;
    const rect = bodyRef.current.getBoundingClientRect();
    const slotIndex = Math.floor((e.clientY - rect.top) / ROW_HEIGHT);
    const mins = GRID_START + slotIndex * SLOT_MINS;
    if (mins >= GRID_START && mins < GRID_END) {
      const h = Math.floor(mins / 60), m = mins % 60;
      setHoverSlot({ y: slotIndex * ROW_HEIGHT, label: `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` });
    } else setHoverSlot(null);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden border border-stone-200 rounded-xl bg-white">
      <div className="sticky top-0 z-20 flex bg-white border-b border-stone-200 shrink-0">
        <div style={{ minWidth: TIME_COL_W, width: TIME_COL_W }} className="shrink-0" />
        {days.map(dateStr => {
          const d = new Date(dateStr + 'T00:00:00');
          const today = dateStr === todayStr;
          return (
            <div key={dateStr} className={`flex-1 min-w-0 flex flex-col items-center justify-center py-2 border-l border-stone-100 gap-0.5 ${today ? 'bg-[#C9A96E]/5' : ''}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${today ? 'text-[#C9A96E]' : 'text-stone-400'}`}>
                {d.toLocaleDateString('en-US', { weekday: 'short' })}
              </p>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${today ? 'bg-[#C9A96E] text-white' : 'text-stone-800'}`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        <div ref={bodyRef} className="flex relative" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverSlot(null)}>
          {hoverSlot && (
            <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: hoverSlot.y }}>
              <div className="absolute inset-x-0 border-t border-dashed border-stone-400" style={{ left: TIME_COL_W }} />
              <span className="absolute -translate-y-1/2 bg-stone-700 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap" style={{ left: TIME_COL_W + 4 }}>
                {hoverSlot.label}
              </span>
            </div>
          )}

          <div style={{ minWidth: TIME_COL_W, width: TIME_COL_W, height: gridHeight }} className="shrink-0 relative">
            {TIME_LABELS.map((label, i) => label.endsWith(':00') && (
              <div key={label} className="absolute right-0 pr-2 flex items-start" style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}>
                <span className="text-[10px] text-stone-400 font-medium leading-none pt-0.5">{formatTime(label)}</span>
              </div>
            ))}
          </div>

          {days.map(dateStr => {
            const today = dateStr === todayStr;
            const colBookings = (byDate[dateStr] || []).filter(b => {
              const s = timeToMins(b.start_time); const e = b.end_time ? timeToMins(b.end_time) : s + 60;
              return e > GRID_START && s < GRID_END;
            });
            return (
              <div key={dateStr} className={`flex-1 min-w-0 border-l border-stone-100 relative ${today ? 'bg-[#C9A96E]/[0.02]' : ''}`} style={{ height: gridHeight }}>
                {TIME_LABELS.map((label, i) => (
                  <div key={label} className={`absolute left-0 right-0 ${label.endsWith(':00') ? 'border-t border-stone-200' : 'border-t border-stone-100'}`} style={{ top: i * ROW_HEIGHT }} />
                ))}
                {today && <NowIndicator />}
                {colBookings.map(b => (
                  <BookingBlock key={b.id} booking={b} selected={selected} onSelect={onSelectBooking} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Month grid ────────────────────────────────────────────────────
function MonthGrid({ year, month, counts, onDayClick }) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const offset   = (firstDay.getDay() + 6) % 7;
  const todayStr = toDateStr(new Date());

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ d, dateStr });
  }

  return (
    <div className="flex-1 flex flex-col border border-stone-200 rounded-xl bg-white overflow-hidden">
      <div className="grid grid-cols-7 border-b border-stone-200 shrink-0">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => (
          <div key={day} className="text-[11px] font-semibold text-stone-400 text-center py-2.5 border-r border-stone-100 last:border-0">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: '1fr' }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} className="border-r border-b border-stone-100" />;
          const { d, dateStr } = cell;
          const total   = counts[dateStr]?.total || 0;
          const pending = counts[dateStr]?.pending || 0;
          const isT   = dateStr === todayStr;
          const isPast = dateStr < todayStr;
          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(dateStr)}
              className={`border-r border-b border-stone-100 p-2 text-left flex flex-col transition-colors hover:bg-stone-50 ${isT ? 'bg-[#C9A96E]/5' : ''}`}
            >
              <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isT ? 'bg-[#C9A96E] text-white' : isPast ? 'text-stone-300' : 'text-stone-700'}`}>
                {d}
              </span>
              {total > 0 && <span className="text-[10px] font-medium text-stone-500">{total} appt{total > 1 ? 's' : ''}</span>}
              {pending > 0 && <span className="text-[10px] font-medium text-amber-600">{pending} pending</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Right panel ───────────────────────────────────────────────────
function RightPanel({ booking, bookings, monthCounts, staffColumns, date, view, loading, onClose }) {
  const activeToday    = bookings;
  const pendingCount   = bookings.filter(b => b.status === 'pending').length;
  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;

  // Month view totals come from monthCounts, not bookings
  const monthTotal     = Object.values(monthCounts).reduce((s, d) => s + (d.total   || 0), 0);
  const monthPending   = Object.values(monthCounts).reduce((s, d) => s + (d.pending || 0), 0);
  const monthConfirmed = monthTotal - monthPending;

  const displayTotal     = view === 'month' ? monthTotal     : activeToday.length;
  const displayPending   = view === 'month' ? monthPending   : pendingCount;
  const displayConfirmed = view === 'month' ? monthConfirmed : confirmedCount;

  if (!booking) {
    // Summary state
    return (
      <div className="w-96 shrink-0 bg-white border-l border-stone-200 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">
            {view === 'day' ? date.toLocaleDateString('en-US', { weekday: 'long' }) : view === 'week' ? 'This week' : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <p className="text-lg font-bold text-stone-900 font-playfair">
            {view === 'day'
              ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
              : view === 'week'
              ? `${displayTotal} Appointments`
              : date.toLocaleDateString('en-US', { month: 'long' })}
          </p>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-stone-200 border-t-[#C9A96E] rounded-full animate-spin" />
          </div>
        ) : (
        <>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Total</p>
              <p className="text-2xl font-bold text-stone-900">{displayTotal}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-[10px] text-amber-600 uppercase tracking-wide mb-1">Pending</p>
              <p className="text-2xl font-bold text-amber-700">{displayPending}</p>
            </div>
          </div>
          <div className="bg-[#C9A96E]/8 rounded-xl p-3">
            <p className="text-[10px] text-[#C9A96E] uppercase tracking-wide mb-1">Confirmed</p>
            <p className="text-2xl font-bold text-stone-900">{displayConfirmed}</p>
          </div>
        </div>

        {activeToday.length > 0 && (
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Upcoming</p>
            <div className="space-y-1.5">
              {activeToday
                .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                .slice(0, 8)
                .map(b => (
                  <div key={b.id} className="flex items-center gap-2 py-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.status === 'pending' ? 'bg-amber-400' : 'bg-[#C9A96E]'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-stone-700 truncate">{b.caller_name || 'Guest'}</p>
                      <p className="text-[10px] text-stone-400 truncate">{formatTime(b.start_time)} · {getService(b)}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeToday.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-6">
              <CalendarDays size={28} className="text-stone-200 mx-auto mb-2" />
              <p className="text-xs text-stone-400">No appointments</p>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    );
  }

  // Booking detail state
  return <BookingDetailPanel booking={booking} staffColumns={staffColumns} onClose={onClose} />;
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

function BookingDetailPanel({ booking, staffColumns = [], onClose }) {
  const [notes, setNotes]           = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteBody, setNoteBody]     = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError]   = useState('');
  const [payment, setPayment]       = useState(null);   // null=loading, []=none
  const [policies, setPolicies]     = useState(undefined); // undefined=loading

  useEffect(() => {
    setNotes([]); setNotesLoading(true);
    setPayment(null); setPolicies(undefined);
    setNoteBody(''); setNoteError('');

    api.getBookingNotes(booking.id)
      .then(setNotes).catch(() => {}).finally(() => setNotesLoading(false));
    api.getBookingPayment(booking.id)
      .then(setPayment).catch(() => setPayment([]));
    api.getBookingPolicies(booking.id)
      .then(setPolicies).catch(() => setPolicies(null));
  }, [booking.id]);

  const canAddNote = booking.status !== 'cancelled';

  const service      = getService(booking);
  const durationMins = booking.event_types?.duration_minutes
    || booking.booking_event_types?.reduce((s, x) => s + (x.event_types?.duration_minutes || 0), 0)
    || null;
  const bufferMins   = booking.event_types?.buffer_minutes
    || booking.booking_event_types?.[0]?.event_types?.buffer_minutes || 0;
  const endTime = (() => {
    const base = booking.end_time ? timeToMins(booking.end_time) : (durationMins ? timeToMins(booking.start_time) + durationMins : null);
    if (base === null) return null;
    const m = base + bufferMins;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  })();

  async function handleAddNote(e) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setNoteSubmitting(true); setNoteError('');
    try {
      const note = await api.addBookingNote(booking.id, noteBody.trim());
      setNotes(prev => [...prev, note]);
      setNoteBody('');
    } catch (err) {
      setNoteError(err.message);
    } finally {
      setNoteSubmitting(false);
    }
  }

  return (
    <div className="w-96 shrink-0 bg-white border-l border-stone-200 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-200 flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">Appointment</p>
          <p className="text-base font-bold text-stone-900 font-playfair truncate">{service}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors shrink-0 mt-0.5">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">

          {/* ── Customer ── */}
          <Section title="Customer">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-stone-600">{getInitials(booking.caller_name || '?')}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-800">{booking.caller_name || '—'}</p>
                {booking.caller_phone && <p className="text-xs text-stone-400 mt-0.5">{booking.caller_phone}</p>}
                {booking.caller_email && <p className="text-xs text-stone-400 truncate">{booking.caller_email}</p>}
                {booking.booked_via === 'mobile_app' && (
                  <span className="inline-flex mt-1 text-[10px] font-medium text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-full">Mobile app</span>
                )}
              </div>
              <span className={`ml-auto shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[booking.status] || STATUS_BADGE.confirmed}`}>
                {STATUS_LABEL[booking.status] || booking.status}
              </span>
            </div>

            {booking.profiles?.name && (() => {
              const staffCol = staffColumns.find(c => c.id === booking.user_id);
              const avatarUrl = staffCol?.avatar_url || null;
              return (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-stone-100">
                  {avatarUrl
                    ? <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    : <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(booking.profiles.name)}`}>
                        {getInitials(booking.profiles.name)}
                      </div>
                  }
                  <div>
                    <p className="text-[10px] text-stone-400">Booked with</p>
                    <p className="text-sm font-semibold text-stone-800">{booking.profiles.name}</p>
                  </div>
                </div>
              );
            })()}
          </Section>

          <div className="border-t border-stone-100" />

          {/* ── Appointment details ── */}
          <Section title="Appointment">
            <div className="space-y-3">
              {/* Service table */}
              <div className="rounded-xl border border-stone-100 overflow-hidden text-xs">
                <div className="grid grid-cols-3 bg-stone-50 px-3 py-2 font-semibold text-stone-400 uppercase tracking-wide text-[10px]">
                  <span>Service</span><span className="text-right">Duration</span><span className="text-right">Price</span>
                </div>
                {(booking.booking_event_types?.length > 0
                  ? booking.booking_event_types.map(x => x.event_types).filter(Boolean)
                  : booking.event_types ? [booking.event_types] : []
                ).map((et, i) => (
                  <div key={i} className="grid grid-cols-3 px-3 py-2 border-t border-stone-100 text-stone-700">
                    <span className="truncate pr-2">{et.name}</span>
                    <span className="text-right">{et.duration_minutes} min</span>
                    <span className="text-right">{et.price_cents > 0 ? `$${(et.price_cents/100).toFixed(2)}` : '—'}</span>
                  </div>
                ))}
              </div>

              {/* Date */}
              <div>
                <p className="text-[10px] text-stone-400 mb-0.5">Date</p>
                <p className="text-sm text-stone-700">
                  {new Date(booking.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Timeline */}
              <div>
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <p className="text-[10px] text-stone-400">Start time</p>
                    <p className="text-sm font-semibold text-stone-700">{formatTime(booking.start_time)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-stone-400">End time</p>
                    <p className="text-sm font-semibold text-stone-700">{endTime ? formatTime(endTime) : '—'}</p>
                  </div>
                </div>

                {bufferMins > 0 && durationMins ? (() => {
                  const total = durationMins + bufferMins;
                  const durPct = (durationMins / total) * 100;
                  const bufPct = (bufferMins   / total) * 100;
                  return (
                    <div>
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#C9A96E] shrink-0" />
                        <div className="flex-1 flex items-center">
                          <div className="flex items-center" style={{ width: `${durPct}%` }}>
                            <div className="flex-1 border-t-2 border-dashed border-[#C9A96E]/60" />
                          </div>
                          <div className="w-0.5 h-3 bg-stone-300 shrink-0" />
                          <div className="flex items-center" style={{ width: `${bufPct}%` }}>
                            <div className="flex-1 border-t-2 border-dashed border-stone-300" />
                          </div>
                        </div>
                        <div className="w-2.5 h-2.5 rounded-full bg-[#C9A96E] shrink-0" />
                      </div>
                      <div className="flex mt-1" style={{ paddingLeft: 10, paddingRight: 10 }}>
                        <div className="text-center text-[10px] text-stone-400" style={{ width: `${durPct}%` }}>duration</div>
                        <div className="text-center text-[10px] text-stone-300" style={{ width: `${bufPct}%` }}>buffer</div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#C9A96E] shrink-0" />
                    <div className="flex-1 border-t-2 border-dashed border-stone-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#C9A96E] shrink-0" />
                  </div>
                )}
              </div>

            </div>
          </Section>

          <div className="border-t border-stone-100" />

          {/* ── Payment ── */}
          <Section title="Payment">
            {payment === null ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-14 bg-stone-100 rounded-xl" />
              </div>
            ) : payment.length === 0 ? (
              <div className="bg-stone-50 rounded-xl border border-stone-100 px-4 py-3">
                <p className="text-xs text-stone-400 italic">No payment collected for this booking.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payment.map(attempt => (
                  <div key={attempt.id} className="bg-stone-50 rounded-xl border border-stone-100 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-stone-800">
                        {attempt.amount_cents != null ? `$${(attempt.amount_cents/100).toFixed(2)}` : '—'}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${
                        attempt.status === 'succeeded' ? 'bg-emerald-100 text-emerald-700'
                        : attempt.status === 'failed'  ? 'bg-red-100 text-red-600'
                        : 'bg-stone-100 text-stone-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${attempt.status === 'succeeded' ? 'bg-emerald-500' : attempt.status === 'failed' ? 'bg-red-400' : 'bg-stone-400'}`} />
                        {attempt.status || 'unknown'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><p className="text-stone-400">Provider</p><p className="text-stone-700 capitalize">{attempt.provider}</p></div>
                      <div><p className="text-stone-400">Date</p><p className="text-stone-700">{new Date(attempt.attempted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p></div>
                    </div>
                    {attempt.provider_payment_id && (
                      <div className="text-xs"><p className="text-stone-400">Payment ID</p><p className="font-mono text-stone-600 break-all">{attempt.provider_payment_id}</p></div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Policies ── */}
          {policies !== undefined && policies !== null && (policies.refund_policy_snapshot || policies.cancellation_policy_hours_snapshot != null || policies.no_show_fee_type_snapshot != null) && (
            <>
              <div className="border-t border-stone-100" />
              <Section title="Policies shown at booking time">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2.5 text-xs text-amber-900">
                  {policies.refund_policy_snapshot && (
                    <div>
                      <p className="font-semibold text-amber-700 mb-0.5">Refund policy</p>
                      <p className="leading-relaxed">{policies.refund_policy_snapshot}</p>
                    </div>
                  )}
                  {policies.cancellation_policy_hours_snapshot != null && (
                    <div>
                      <p className="font-semibold text-amber-700 mb-0.5">Cancellation policy</p>
                      <p className="leading-relaxed">
                        {policies.cancellation_fee_type_snapshot === 'percentage'
                          ? `${policies.cancellation_fee_amount_snapshot}% fee`
                          : `$${((policies.cancellation_fee_amount_snapshot || 0)/100).toFixed(2)} fee`
                        } if cancelled within {policies.cancellation_policy_hours_snapshot}h
                      </p>
                      {policies.paid_online && <p className="mt-1 text-amber-700 italic">Paid in full — cancellation fee will not apply.</p>}
                    </div>
                  )}
                  {policies.no_show_fee_type_snapshot != null && (
                    <div>
                      <p className="font-semibold text-amber-700 mb-0.5">No-show policy</p>
                      <p className="leading-relaxed">
                        {policies.no_show_fee_type_snapshot === 'percentage'
                          ? `${policies.no_show_fee_amount_snapshot}% fee`
                          : `$${((policies.no_show_fee_amount_snapshot || 0)/100).toFixed(2)} fee`
                        } charged for no-shows
                      </p>
                      {policies.paid_online && <p className="mt-1 text-amber-700 italic">Paid in full — no-show fee will not apply.</p>}
                    </div>
                  )}
                </div>
              </Section>
            </>
          )}

          <div className="border-t border-stone-100" />

          {/* ── Notes ── */}
          <Section title="Notes">
            {notesLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1,2].map(i => <div key={i} className="h-12 bg-stone-100 rounded-xl" />)}
              </div>
            ) : notes.length > 0 ? (
              <div className="space-y-2 mb-3">
                {notes.map(note => (
                  <div key={note.id} className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${avatarColor(note.author_name || '')}`}>
                        {(note.author_name?.[0] || '?').toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-stone-700">{note.author_name}</span>
                      <span className="text-[10px] text-stone-400">
                        {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed">{note.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic mb-3">No notes yet.</p>
            )}

            {canAddNote && (
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  value={noteBody}
                  onChange={e => setNoteBody(e.target.value)}
                  rows={2}
                  maxLength={280}
                  placeholder="Add a note…"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 placeholder-stone-400 focus:border-[#C9A96E] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/10 transition resize-none"
                />
                <div className="flex items-center justify-between">
                  <p className={`text-[10px] ${noteBody.length >= 260 ? noteBody.length >= 280 ? 'text-red-500' : 'text-amber-500' : 'text-stone-400'}`}>
                    {280 - noteBody.length} chars left
                  </p>
                  <button
                    type="submit"
                    disabled={noteSubmitting || !noteBody.trim()}
                    className="rounded-lg bg-stone-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-stone-800 transition-colors disabled:opacity-40"
                  >
                    {noteSubmitting ? 'Adding…' : 'Add Note'}
                  </button>
                </div>
                {noteError && <p className="text-[10px] text-red-500">{noteError}</p>}
              </form>
            )}

            {!canAddNote && (
              <p className="text-[10px] text-stone-400 italic">
                Notes cannot be added to cancelled bookings.
              </p>
            )}
          </Section>

        </div>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────
export default function Dashboard({ session, onSignOut }) {
  const [view, setView]               = useState('day');
  const [date, setDate]               = useState(new Date());
  const [bookings, setBookings]       = useState([]);
  const [monthCounts, setMonthCounts] = useState({});
  const [profile, setProfile]         = useState(null);
  const [staff, setStaff]             = useState([]);
  const [staffPage, setStaffPage]     = useState(0);
  const [weekStaffId, setWeekStaffId] = useState(null); // null = own bookings default, set after profile loads
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [selected, setSelected]       = useState(null);

  useEffect(() => {
    api.getProfile().then(p => { setProfile(p); setWeekStaffId(session.user.id); }).catch(() => {});
    api.getStaff().then(res => {
      setStaff((res.staff || []).filter(s => s.status === 'active'));
    }).catch(() => {});
  }, []);

  const staffColumns = profile ? [
    { id: session.user.id, name: profile.name, avatar_url: profile.avatar_url || null, isOwner: true, isToday: isToday(date) },
    ...staff.map(s => ({ id: s.id, name: s.name, avatar_url: s.avatar_url, isOwner: false, isToday: isToday(date) })),
  ] : [];

  const load = useCallback(async (d, v) => {
    setLoading(true);
    setError(null);
    try {
      if (v === 'month') {
        const from   = toDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
        const to     = toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
        const counts = await api.getMonthlyBookingCounts(from, to);
        setMonthCounts(counts || {});
      } else if (v === 'week') {
        const days = getWeekDays(d);
        const res  = await api.getBookings({ from: days[0], to: days[6], page_size: 500 });
        setBookings((res.bookings || []).filter(b => b.status !== 'cancelled'));
      } else {
        const res = await api.getBookings({ from: toDateStr(d), to: toDateStr(d), page_size: 500 });
        setBookings((res.bookings || []).filter(b => b.status !== 'cancelled'));
      }
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date, view); }, [date, view, load]);

  // Reset staff page when view changes
  function switchView(v) {
    if (v === view) return;
    setView(v);
    setStaffPage(0);
    setSelected(null);
    setBookings([]);
    setLoading(true);
  }

  function goTo(delta) {
    setDate(prev => {
      const d = new Date(prev);
      if (view === 'week')       d.setDate(d.getDate() + delta * 7);
      else if (view === 'month') d.setMonth(d.getMonth() + delta);
      else                       d.setDate(d.getDate() + delta);
      return d;
    });
  }

  const weekDays = getWeekDays(date);

  return (
    <div className="flex flex-col h-screen bg-[#FAFAF8] overflow-hidden">

      {/* Top bar */}
      <div data-tauri-drag-region className="h-12 bg-white border-b border-stone-200 flex items-center px-5 gap-3 shrink-0">
        <img src="/timply-logo.svg" alt="Timply" className="h-5 w-auto" />
        <div className="flex-1" />
        {profile && (
          <div className="flex items-center gap-2">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
              : <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-stone-700">{getInitials(profile.name)}</span>
                </div>
            }
            <span className="text-xs font-medium text-stone-600">{profile.name}</span>
          </div>
        )}
        <button
          onClick={onSignOut}
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          title="Sign out"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <LogOut size={14} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="h-11 bg-white border-b border-stone-200 flex items-center px-5 gap-3 shrink-0">
        <div className="flex items-center bg-stone-100 rounded-lg p-0.5">
          {['day', 'week', 'month'].map(v => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors capitalize ${view === v ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-800'}`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 bg-stone-100 rounded-lg p-0.5">
          <button onClick={() => goTo(-1)} className="p-1.5 rounded-md hover:bg-stone-200 transition-colors text-stone-600">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setDate(new Date())} className="px-3 py-1 rounded-md text-[11px] font-semibold text-stone-500 hover:text-stone-800 transition-colors">
            Today
          </button>
          <button onClick={() => goTo(1)} className="p-1.5 rounded-md hover:bg-stone-200 transition-colors text-stone-600">
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <CalendarDays size={13} className="text-stone-400" />
          <h1 className="text-xs font-semibold text-stone-700">
            {view === 'week' ? formatWeekHeading(date) : view === 'month' ? formatMonthHeading(date) : formatHeading(date)}
          </h1>
        </div>

        <div className="flex-1" />

        {/* Week view — staff picker */}
        {view === 'week' && staffColumns.length > 1 && (
          <select
            value={weekStaffId || ''}
            onChange={e => setWeekStaffId(e.target.value)}
            className="text-[11px] font-medium text-stone-700 bg-stone-100 border-0 rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:bg-stone-200 transition-colors"
          >
            {staffColumns.map(col => (
              <option key={col.id} value={col.id}>
                {col.name}{col.isOwner ? ' (Owner)' : ''}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => load(date, view)}
          disabled={loading}
          className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Calendar area */}
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-5 h-5 border-2 border-stone-200 border-t-[#C9A96E] rounded-full animate-spin" />
                <p className="text-xs text-stone-400">Loading…</p>
              </div>
            </div>

          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm font-medium text-red-600 mb-1">Failed to load</p>
                <p className="text-xs text-stone-400 mb-3">{error}</p>
                <button onClick={() => load(date, view)} className="text-xs font-medium text-stone-700 border border-stone-200 rounded-lg px-3 py-1.5 hover:bg-stone-50 transition-colors">
                  Retry
                </button>
              </div>
            </div>

          ) : view === 'month' ? (
            <MonthGrid
              year={date.getFullYear()}
              month={date.getMonth()}
              counts={monthCounts}
              onDayClick={(dateStr) => { setSelected(null); setDate(new Date(dateStr + 'T00:00:00')); setView('day'); }}
            />

          ) : view === 'week' ? (
            <WeekGrid
              days={weekDays}
              bookings={weekStaffId ? bookings.filter(b => b.user_id === weekStaffId) : bookings}
              selected={selected}
              onSelectBooking={setSelected}
            />

          ) : (
            staffColumns.length > 0
              ? <StaffDayGrid columns={staffColumns} bookings={bookings} selected={selected} onSelectBooking={setSelected} staffPage={staffPage} setStaffPage={setStaffPage} />
              : <div className="flex-1 flex items-center justify-center"><div className="w-5 h-5 border-2 border-stone-200 border-t-[#C9A96E] rounded-full animate-spin" /></div>
          )}
        </div>

        {/* Always-visible right panel */}
        <RightPanel
          booking={selected}
          bookings={view === 'week' && weekStaffId ? bookings.filter(b => b.user_id === weekStaffId) : bookings}
          monthCounts={monthCounts}
          staffColumns={staffColumns}
          date={date}
          view={view}
          loading={loading}
          onClose={() => setSelected(null)}
        />
      </div>
    </div>
  );
}
