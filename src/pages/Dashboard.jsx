import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { useRealtimeSSE } from '../lib/useRealtimeSSE';
import {
  ChevronLeft, ChevronRight, CalendarDays, RefreshCw,
  LogOut, X, Settings as SettingsIcon, Bell
} from 'lucide-react';
import Settings from './Settings';

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

// ── Date picker ───────────────────────────────────────────────────
const DP_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DP_MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DP_DAYS         = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function DatePickerPopup({ value, onChange, onClose }) {
  const now   = new Date();
  const [mode, setMode]       = useState('day');
  const [viewYear, setViewYear]   = useState((value || now).getFullYear());
  const [viewMonth, setViewMonth] = useState((value || now).getMonth());

  const tY = now.getFullYear(), tM = now.getMonth(), tD = now.getDate();
  const sY = value?.getFullYear(), sM = value?.getMonth(), sD = value?.getDate();

  // year grid: 12-year pages
  const yearBase = Math.floor(viewYear / 12) * 12;

  // day grid cells
  const firstDow   = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const btn = 'flex items-center justify-center rounded-lg text-xs font-medium transition-colors';

  function prevMonth() { viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y-1)) : setViewMonth(m => m-1); }
  function nextMonth() { viewMonth === 11 ? (setViewMonth(0),  setViewYear(y => y+1)) : setViewMonth(m => m+1); }

  return (
    <div className="bg-stone-900 border border-stone-700/60 rounded-2xl shadow-2xl p-4 w-64 select-none">

      {/* ── Year mode ── */}
      {mode === 'year' && (<>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setViewYear(y => y-12)} className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-400 transition-colors"><ChevronLeft size={13}/></button>
          <span className="text-[11px] font-semibold text-stone-300">{yearBase} – {yearBase+11}</span>
          <button onClick={() => setViewYear(y => y+12)} className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-400 transition-colors"><ChevronRight size={13}/></button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 12 }, (_, i) => yearBase + i).map(y => (
            <button key={y} onClick={() => { setViewYear(y); setMode('month'); }}
              className={`${btn} h-9 ${y === sY ? 'bg-[#C9A96E] text-stone-900' : y === tY ? 'text-[#C9A96E] hover:bg-stone-700' : 'text-stone-300 hover:bg-stone-700'}`}>
              {y}
            </button>
          ))}
        </div>
      </>)}

      {/* ── Month mode ── */}
      {mode === 'month' && (<>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setViewYear(y => y-1)} className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-400 transition-colors"><ChevronLeft size={13}/></button>
          <button onClick={() => setMode('year')} className="text-[11px] font-semibold text-[#C9A96E] hover:text-[#d4b87e] transition-colors">{viewYear}</button>
          <button onClick={() => setViewYear(y => y+1)} className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-400 transition-colors"><ChevronRight size={13}/></button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {DP_MONTHS_SHORT.map((m, i) => (
            <button key={m} onClick={() => { setViewMonth(i); setMode('day'); }}
              className={`${btn} h-9 ${i === sM && viewYear === sY ? 'bg-[#C9A96E] text-stone-900' : i === tM && viewYear === tY ? 'text-[#C9A96E] hover:bg-stone-700' : 'text-stone-300 hover:bg-stone-700'}`}>
              {m}
            </button>
          ))}
        </div>
      </>)}

      {/* ── Day mode ── */}
      {mode === 'day' && (<>
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-400 transition-colors"><ChevronLeft size={13}/></button>
          <button onClick={() => setMode('month')} className="text-[11px] font-semibold text-[#C9A96E] hover:text-[#d4b87e] transition-colors">
            {DP_MONTHS_FULL[viewMonth]} {viewYear}
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-400 transition-colors"><ChevronRight size={13}/></button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {DP_DAYS.map(d => <div key={d} className="flex items-center justify-center text-[10px] font-semibold text-stone-500 h-6">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => !day ? <div key={`e-${i}`}/> : (
            <button key={day}
              onClick={() => { onChange(new Date(viewYear, viewMonth, day)); onClose(); }}
              className={`${btn} h-8 w-full ${
                day === sD && viewMonth === sM && viewYear === sY ? 'bg-[#C9A96E] text-stone-900' :
                day === tD && viewMonth === tM && viewYear === tY ? 'text-[#C9A96E] ring-1 ring-[#C9A96E]/60 hover:bg-stone-700' :
                'text-stone-300 hover:bg-stone-700'
              }`}>
              {day}
            </button>
          ))}
        </div>
      </>)}

    </div>
  );
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
      data-booking-id={booking.id}
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
function StaffDayGrid({ columns, bookings, selected, onSelectBooking, staffPage, setStaffPage, date: dateStr, onSlotClick }) {
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
              <div
                key={col.id}
                className={`flex-1 min-w-0 border-l border-stone-100 relative ${onSlotClick ? 'cursor-pointer' : ''}`}
                style={{ height: gridHeight }}
                onClick={(e) => {
                  if (!onSlotClick || !dateStr) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const slotIndex = Math.floor((e.clientY - rect.top) / ROW_HEIGHT);
                  const mins = GRID_START + slotIndex * SLOT_MINS;
                  if (mins >= GRID_START && mins < GRID_END) {
                    const h = String(Math.floor(mins / 60)).padStart(2, '0');
                    const m = String(mins % 60).padStart(2, '0');
                    onSlotClick({ date: dateStr, time: `${h}:${m}`, userId: col.id });
                  }
                }}
              >
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
function WeekGrid({ days, bookings, selected, onSelectBooking, onSlotClick }) {
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
              <div
                key={dateStr}
                className={`flex-1 min-w-0 border-l border-stone-100 relative ${today ? 'bg-[#C9A96E]/[0.02]' : ''} ${onSlotClick ? 'cursor-pointer' : ''}`}
                style={{ height: gridHeight }}
                onClick={(e) => {
                  if (!onSlotClick) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const slotIndex = Math.floor((e.clientY - rect.top) / ROW_HEIGHT);
                  const mins = GRID_START + slotIndex * SLOT_MINS;
                  if (mins >= GRID_START && mins < GRID_END) {
                    const h = String(Math.floor(mins / 60)).padStart(2, '0');
                    const m = String(mins % 60).padStart(2, '0');
                    onSlotClick({ date: dateStr, time: `${h}:${m}` });
                  }
                }}
              >
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

// ── New appointment panel ─────────────────────────────────────────
function NewAppointmentPanel({ slot, staffColumns, ownerUserId, dayBookings, onClose, onCreated }) {
  const [eventTypes, setEventTypes]     = useState([]);
  const [etLoading, setEtLoading]       = useState(true);
  const [selectedEts, setSelectedEts]   = useState([]);  // multi-select array
  const [callerName, setCallerName]     = useState('');
  const [callerPhone, setCallerPhone]   = useState('');
  const [callerEmail, setCallerEmail]   = useState('');
  const [notes, setNotes]               = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const [effectiveSlot, setEffectiveSlot] = useState(slot);
  const [findingNext, setFindingNext]   = useState(false);

  // Reset effective slot when user clicks a different cell
  useEffect(() => { setEffectiveSlot(slot); }, [slot.date, slot.time, slot.userId]);

  useEffect(() => {
    api.getEventTypes()
      .then(data => { setEventTypes((data || []).filter(et => et.active !== false)); })
      .catch(() => {})
      .finally(() => setEtLoading(false));
  }, []);

  function toggleEt(et) {
    setSelectedEts(prev =>
      prev.some(e => e.id === et.id) ? prev.filter(e => e.id !== et.id) : [...prev, et]
    );
  }

  // ── Duration math ─────────────────────────────────────────────
  const totalDuration = selectedEts.reduce((s, et) => s + et.duration_minutes, 0);
  const maxBuffer     = selectedEts.length > 0 ? Math.max(...selectedEts.map(et => et.buffer_minutes || 0)) : 0;
  const totalMins     = totalDuration + maxBuffer;

  function minsToTime(m) {
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  const slotStartMins = timeToMins(effectiveSlot.time);
  const slotEndMins   = selectedEts.length > 0 ? slotStartMins + totalMins : null;
  const endTimeStr    = slotEndMins !== null ? minsToTime(slotEndMins) : null;

  // ── Overlap check against loaded bookings for the clicked day ──
  // Only check when the effective slot is still the originally-clicked date;
  // if user jumped via "find next available" we trust the backend.
  const overlapBooking = (effectiveSlot.date === slot.date && slotEndMins !== null)
    ? (dayBookings || []).find(b => {
        const bStart = timeToMins(b.start_time);
        return bStart >= slotStartMins && bStart < slotEndMins;
      })
    : null;

  const isStaff = effectiveSlot.userId && effectiveSlot.userId !== ownerUserId;
  const staffCol = staffColumns.find(c => c.id === effectiveSlot.userId);

  // ── Find next available ────────────────────────────────────────
  async function findNextAvailable() {
    if (selectedEts.length === 0) return;
    setFindingNext(true); setError('');
    try {
      const etIds = selectedEts.map(e => e.id).join(',');
      const data  = isStaff
        ? await api.getStaffNextAvailableSlot(effectiveSlot.userId, etIds)
        : await api.getNextAvailableSlot(etIds);
      if (data.date && data.slots?.length > 0) {
        setEffectiveSlot(prev => ({ ...prev, date: data.date, time: data.slots[0].start_time }));
      } else {
        setError('No available slot found in the next 60 days for the selected services.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setFindingNext(false);
    }
  }

  // ── Submit ─────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!callerName.trim())       { setError('Customer name is required'); return; }
    if (selectedEts.length === 0) { setError('Please select at least one service'); return; }
    if (overlapBooking)           { return; }
    setSubmitting(true); setError('');
    try {
      const created = await api.createBooking({
        event_type_ids: selectedEts.map(e => e.id),
        caller_name:    callerName.trim(),
        caller_phone:   callerPhone.trim() || undefined,
        caller_email:   callerEmail.trim() || undefined,
        date:           effectiveSlot.date,
        start_time:     effectiveSlot.time,
        end_time:       endTimeStr,
        notes:          notes.trim() || undefined,
        ...(isStaff ? { staff_user_id: effectiveSlot.userId } : {}),
      });

      // Build a synthetic booking in the same shape getBookings returns,
      // so the grid can update in-place without a full reload.
      const etShape = (et) => ({ id: et.id, name: et.name, duration_minutes: et.duration_minutes, buffer_minutes: et.buffer_minutes, price_cents: et.price_cents });
      const syntheticBooking = {
        ...created,
        // Single service: event_types join; multi: null (booking_event_types takes precedence)
        event_types: selectedEts.length === 1 ? etShape(selectedEts[0]) : null,
        // Multi-service rows (empty for single — backend only inserts when ids.length > 1)
        booking_event_types: selectedEts.length > 1
          ? selectedEts.map(et => ({ event_types: etShape(et) }))
          : [],
        profiles: staffCol ? { name: staffCol.name, role: staffCol.isOwner ? 'owner' : 'staff' } : null,
      };

      onCreated && onCreated(syntheticBooking);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="w-96 shrink-0 bg-white border-l border-stone-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-200 flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">New Appointment</p>
          <p className="text-base font-bold text-stone-900 font-playfair truncate">Book a slot</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors shrink-0 mt-0.5">
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">

          {/* Date + time info card */}
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Date & Time</p>
              <p className="text-sm font-semibold text-stone-800">
                {new Date(effectiveSlot.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}{formatTime(effectiveSlot.time)}
                {endTimeStr && <span className="text-stone-400 font-normal"> – {formatTime(endTimeStr)}</span>}
              </p>
              {totalMins > 0 && (
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {totalDuration} min{maxBuffer > 0 ? ` + ${maxBuffer} min buffer` : ''}
                </p>
              )}
            </div>
            {staffCol && (
              <div className="flex items-center gap-1.5 shrink-0">
                {staffCol.avatar_url
                  ? <img src={staffCol.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  : <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold ${avatarColor(staffCol.name)}`}>{getInitials(staffCol.name)}</div>
                }
                <span className="text-xs text-stone-600 font-medium">{staffCol.name}</span>
              </div>
            )}
          </div>

          {/* Overlap warning */}
          {overlapBooking && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <p className="font-semibold mb-1">Services don't fit in this slot</p>
              <p className="leading-relaxed mb-2">
                The total duration ({totalMins} min) would end at {formatTime(endTimeStr)}, overlapping with{' '}
                <span className="font-medium">{overlapBooking.caller_name || 'an appointment'}</span> at {formatTime(overlapBooking.start_time)}.
                Remove some services so it fits, or find the next available slot.
              </p>
              <button
                type="button"
                onClick={findNextAvailable}
                disabled={findingNext}
                className="font-semibold text-amber-700 hover:text-amber-900 disabled:opacity-50 transition-colors"
              >
                {findingNext ? 'Finding…' : 'Find next available →'}
              </button>
            </div>
          )}

          {/* Services — multi-select */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Services</p>
              {selectedEts.length > 0 && (
                <span className="text-[10px] font-medium text-stone-500">{selectedEts.length} selected</span>
              )}
            </div>
            {etLoading ? (
              <div className="space-y-1.5">
                {[1,2,3].map(i => <div key={i} className="h-14 bg-stone-100 rounded-lg animate-pulse" />)}
              </div>
            ) : eventTypes.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No active services found.</p>
            ) : (
              <div className="space-y-1.5">
                {eventTypes.map(et => {
                  const checked = selectedEts.some(e => e.id === et.id);
                  return (
                    <button
                      key={et.id}
                      type="button"
                      onClick={() => toggleEt(et)}
                      className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        checked ? 'border-[#C9A96E] bg-[#C9A96E]/5' : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        checked ? 'border-[#C9A96E] bg-[#C9A96E]' : 'border-stone-300'
                      }`}>
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-stone-800 truncate">{et.name}</p>
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {et.duration_minutes} min
                          {et.buffer_minutes > 0 ? ` · ${et.buffer_minutes} min buffer` : ''}
                          {et.price_cents > 0 ? ` · $${(et.price_cents / 100).toFixed(2)}` : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Customer */}
          <div>
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-3">Customer</p>
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={callerName}
                  onChange={e => setCallerName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-[#C9A96E] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/10 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Phone</label>
                <input
                  type="tel"
                  value={callerPhone}
                  onChange={e => setCallerPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-[#C9A96E] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/10 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Email</label>
                <input
                  type="email"
                  value={callerEmail}
                  onChange={e => setCallerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-[#C9A96E] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/10 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Notes <span className="text-stone-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any notes for this appointment…"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-[#C9A96E] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/10 transition resize-none"
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3 border-t border-stone-100 bg-white space-y-2">
        {error && <p className="text-[10px] text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !callerName.trim() || selectedEts.length === 0 || !!overlapBooking}
            className="flex-1 rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating…' : 'Create Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Right panel ───────────────────────────────────────────────────
function RightPanel({ booking, newApptSlot, newApptDayBookings, bookings, monthCounts, staffColumns, date, view, loading, ownerUserId, onClose, onUpdated, onNewApptClose, onNewApptCreated }) {
  if (newApptSlot) {
    return <NewAppointmentPanel slot={newApptSlot} staffColumns={staffColumns} ownerUserId={ownerUserId} dayBookings={newApptDayBookings} onClose={onNewApptClose} onCreated={onNewApptCreated} />;
  }

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
  return <BookingDetailPanel booking={booking} staffColumns={staffColumns} onClose={onClose} onUpdated={onUpdated} />;
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

function BookingDetailPanel({ booking, staffColumns = [], onClose, onUpdated }) {
  // Notes state
  const [notes, setNotes]                   = useState([]);
  const [notesLoading, setNotesLoading]     = useState(true);
  const [noteBody, setNoteBody]             = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError]           = useState('');
  // Data state
  const [payment, setPayment]   = useState(null);
  const [policies, setPolicies] = useState(undefined);
  // Action state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]     = useState('');
  // Cancel modal
  const [showCancelConfirm, setShowCancelConfirm]       = useState(false);
  const [cancelReason, setCancelReason]                 = useState('');
  const [cancelOther, setCancelOther]                   = useState('');
  const [refundAcknowledged, setRefundAcknowledged]     = useState(false);
  // No-show modal
  const [showNoShowConfirm, setShowNoShowConfirm] = useState(false);
  // Reschedule
  const [rescheduling, setRescheduling]     = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [reschedPickerOpen, setReschedPickerOpen] = useState(false);
  const reschedPickerRef                    = useRef(null);
  const [slots, setSlots]                   = useState([]);
  const [slotsMessage, setSlotsMessage]     = useState('');
  const [slotsLoading, setSlotsLoading]     = useState(false);
  const [selectedSlot, setSelectedSlot]     = useState(null);
  const [findingNextDate, setFindingNextDate] = useState(false);

  useEffect(() => {
    if (!reschedPickerOpen) return;
    function handleClick(e) {
      if (!reschedPickerRef.current?.contains(e.target)) setReschedPickerOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [reschedPickerOpen]);

  useEffect(() => {
    setNotes([]); setNotesLoading(true);
    setPayment(null); setPolicies(undefined);
    setNoteBody(''); setNoteError('');
    setActionError('');
    setRescheduling(false);
    setShowCancelConfirm(false);
    setShowNoShowConfirm(false);

    api.getBookingNotes(booking.id)
      .then(setNotes).catch(() => {}).finally(() => setNotesLoading(false));
    api.getBookingPayment(booking.id)
      .then(setPayment).catch(() => setPayment([]));
    api.getBookingPolicies(booking.id)
      .then(setPolicies).catch(() => setPolicies(null));
  }, [booking.id]);

  // Force-close modals if booking becomes cancelled while open
  useEffect(() => {
    if (booking.status === 'cancelled') {
      setRescheduling(false);
      setShowCancelConfirm(false);
    }
  }, [booking.status]);

  // ── Staff vs owner routing ─────────────────────────────────────
  // bookings where user_id !== owner's id belong to a staff member
  const ownerCol       = staffColumns.find(c => c.isOwner);
  const isStaffBooking = !!(ownerCol && booking.user_id && booking.user_id !== ownerCol.id);

  // ── Event type ID for reschedule slot fetching ─────────────────
  // Use > 0 (not > 1): bookings created via booking_event_types path with
  // exactly 1 service have event_type_id = null but booking_event_types[0] set.
  const rescheduleEtId = (booking.booking_event_types?.length ?? 0) > 0
    ? booking.booking_event_types.map(bet => bet.event_types?.id).filter(Boolean).join(',')
    : booking.event_type_id;

  // ── Timing / visibility rules ──────────────────────────────────
  const _now     = new Date();
  const todayStr2 = toDateStr(_now);
  const nowTime  = _now.toTimeString().slice(0, 5);
  const isPast   = booking.date < todayStr2 || (booking.date === todayStr2 && booking.start_time < nowTime);

  const canReschedule  = !isPast && (booking.status === 'confirmed' || booking.status === 'pending');
  const canCancel      = !isPast && (booking.status === 'confirmed' || booking.status === 'pending');
  const canMarkNoShow  = isPast  &&  booking.status === 'confirmed';
  const hasAnyAction   = booking.status === 'pending' || canReschedule || canCancel || canMarkNoShow;

  const isPaidBooking    = Array.isArray(payment) && payment.some(a => a.status === 'succeeded' && a.metadata?.type !== 'no_show_fee');
  const cancelReasonValid = cancelReason && (cancelReason !== 'Other' || cancelOther.trim().length > 0) && (!isPaidBooking || refundAcknowledged);
  const canAddNote = booking.status !== 'cancelled';

  // ── Service info ───────────────────────────────────────────────
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

  // ── Actions ───────────────────────────────────────────────────
  async function handleAction(status) {
    setActionLoading(true); setActionError('');
    try {
      let updated;
      if (status === 'cancelled') {
        const reason = cancelReason === 'Other' ? cancelOther.trim() : cancelReason;
        updated = isStaffBooking
          ? await api.cancelStaffBooking(booking.user_id, booking.id, reason)
          : await api.cancelBooking(booking.id, reason);
      } else {
        updated = isStaffBooking
          ? await api.updateStaffBooking(booking.user_id, booking.id, { status })
          : await api.updateBooking(booking.id, { status });
      }
      onUpdated && onUpdated(updated);
      setActionLoading(false);
    } catch (err) {
      setActionError(err.message);
      setActionLoading(false);
    }
  }

  async function handleNoShow() {
    setActionLoading(true); setActionError('');
    setShowNoShowConfirm(false);
    try {
      const res = await api.markNoShow(booking.id);
      onUpdated && onUpdated(res.booking || res);
      setActionLoading(false);
    } catch (err) {
      setActionError(err.message);
      setActionLoading(false);
    }
  }

  // ── Reschedule ────────────────────────────────────────────────
  async function loadSlots(date) {
    if (!date) return;
    setSlotsLoading(true); setSelectedSlot(null); setSlots([]); setSlotsMessage('');
    try {
      const data = isStaffBooking
        ? await api.getStaffAvailableSlots(booking.user_id, date, rescheduleEtId, booking.id)
        : await api.getAvailableSlots(date, rescheduleEtId, booking.id);
      const fetched = data.slots || [];
      setSlots(fetched);
      setSlotsMessage(data.holiday ? `No availability — ${data.holiday}` : (data.message || ''));
      if (date === booking.date) {
        const cur = fetched.find(s => s.start_time.slice(0, 5) === booking.start_time.slice(0, 5));
        setSelectedSlot(cur || null);
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSlotsLoading(false);
    }
  }

  function openReschedule() {
    setRescheduling(true); setActionError('');
    setRescheduleDate(booking.date);
    loadSlots(booking.date);
  }

  async function findNextAvailable() {
    setFindingNextDate(true); setActionError('');
    try {
      const data = isStaffBooking
        ? await api.getStaffNextAvailableSlot(booking.user_id, rescheduleEtId)
        : await api.getNextAvailableSlot(rescheduleEtId);
      if (data.date) {
        setRescheduleDate(data.date);
        setSlots(data.slots || []);
        setSlotsMessage('');
      } else {
        setActionError('No available slots found in the next 60 days.');
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setFindingNextDate(false);
    }
  }

  async function handleReschedule() {
    if (!selectedSlot) return;
    setActionLoading(true); setActionError('');
    try {
      const payload = { date: rescheduleDate, start_time: selectedSlot.start_time, end_time: selectedSlot.end_time, status: 'confirmed' };
      const updated = isStaffBooking
        ? await api.updateStaffBooking(booking.user_id, booking.id, payload)
        : await api.updateBooking(booking.id, payload);
      onUpdated && onUpdated(updated);
    } catch (err) {
      setActionError(err.message);
      setActionLoading(false);
    }
  }

  // ── Notes ──────────────────────────────────────────────────────
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
    <div className="w-96 shrink-0 bg-white border-l border-stone-200 flex flex-col overflow-hidden relative">

      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-200 flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">
            {rescheduling ? 'Reschedule' : 'Appointment'}
          </p>
          <p className="text-base font-bold text-stone-900 font-playfair truncate">
            {rescheduling ? 'Pick a new date & time' : service}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors shrink-0 mt-0.5">
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {rescheduling ? (
          /* ── Reschedule body ── */
          <div className="p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-stone-600">Date</label>
                <button
                  type="button"
                  onClick={findNextAvailable}
                  disabled={findingNextDate || slotsLoading}
                  className="text-xs font-medium text-[#C9A96E] hover:text-stone-700 disabled:opacity-40 transition-colors"
                >
                  {findingNextDate ? 'Finding…' : 'Next available →'}
                </button>
              </div>
              <div ref={reschedPickerRef} className="relative">
                <button
                  type="button"
                  onClick={() => setReschedPickerOpen(o => !o)}
                  className="w-full flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 hover:border-[#C9A96E]/50 hover:bg-white transition text-left"
                >
                  <span className={rescheduleDate ? 'text-stone-800' : 'text-stone-400'}>
                    {rescheduleDate
                      ? new Date(rescheduleDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Select a date'}
                  </span>
                  <CalendarDays size={13} className="text-stone-400 shrink-0" />
                </button>
                {reschedPickerOpen && (
                  <div className="absolute top-full left-0 mt-2 z-50">
                    <DatePickerPopup
                      value={rescheduleDate ? new Date(rescheduleDate + 'T00:00:00') : null}
                      onChange={d => {
                        const str = toDateStr(d);
                        setRescheduleDate(str);
                        setActionError('');
                        loadSlots(str);
                        setReschedPickerOpen(false);
                      }}
                      onClose={() => setReschedPickerOpen(false)}
                    />
                  </div>
                )}
              </div>
            </div>

            {slotsLoading && <p className="text-xs text-stone-400">Loading slots…</p>}

            {!slotsLoading && rescheduleDate && slots.length === 0 && (
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700 text-center">
                {slotsMessage || 'No available slots on this date'}
              </div>
            )}

            {slots.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Time slot</label>
                <div className="grid grid-cols-3 gap-2">
                  {slots.map(slot => (
                    <button
                      key={slot.start_time}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-lg border py-2 text-xs font-medium transition-colors ${
                        selectedSlot?.start_time === slot.start_time
                          ? 'border-[#C9A96E] bg-[#C9A96E] text-white shadow-sm'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-[#C9A96E]/50 hover:text-stone-800'
                      }`}
                    >
                      {formatTime(slot.start_time)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Normal detail body ── */
          <div className="p-5 space-y-5">

            {booking.status === 'pending' && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700 font-medium">
                This appointment is awaiting your approval
              </div>
            )}

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

                <div>
                  <p className="text-[10px] text-stone-400 mb-0.5">Date</p>
                  <p className="text-sm text-stone-700">
                    {new Date(booking.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>

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
                <div className="space-y-2 animate-pulse"><div className="h-14 bg-stone-100 rounded-xl" /></div>
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
                <p className="text-[10px] text-stone-400 italic">Notes cannot be added to cancelled bookings.</p>
              )}
            </Section>

          </div>
        )}
      </div>

      {/* ── Action buttons footer ── */}
      {!rescheduling && hasAnyAction && (
        <div className="shrink-0 px-5 py-3 border-t border-stone-100 bg-white">
          <div className="flex flex-wrap gap-2">
            {booking.status === 'pending' && (
              <button
                onClick={() => handleAction('confirmed')}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {actionLoading ? '…' : 'Approve'}
              </button>
            )}
            {canReschedule && (
              <button
                onClick={openReschedule}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors disabled:opacity-50"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Reschedule
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => { setCancelReason(''); setCancelOther(''); setRefundAcknowledged(false); setShowCancelConfirm(true); }}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
            )}
            {canMarkNoShow && (
              <button
                onClick={() => setShowNoShowConfirm(true)}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                No-show
              </button>
            )}
          </div>
          {actionError && <p className="text-[10px] text-red-500 mt-2">{actionError}</p>}
        </div>
      )}

      {/* ── Reschedule footer ── */}
      {rescheduling && (
        <div className="shrink-0 px-5 py-3 border-t border-stone-100 bg-white flex gap-2">
          <button
            onClick={() => { setRescheduling(false); setActionError(''); setSlots([]); setSelectedSlot(null); }}
            disabled={actionLoading}
            className="flex-1 rounded-lg border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleReschedule}
            disabled={actionLoading || !selectedSlot}
            className="flex-1 rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? 'Saving…' : 'Confirm'}
          </button>
          {actionError && <p className="text-[10px] text-red-500 mt-1">{actionError}</p>}
        </div>
      )}

      {/* ── No-show confirmation modal ── */}
      {showNoShowConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-5 bg-black/40">
          <div className="w-full bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 pt-5 pb-4 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-stone-800">Mark as no-show?</h3>
              <p className="mt-1 text-xs text-stone-500">
                <span className="font-medium text-stone-700">{booking.caller_name}</span> will be marked as a no-show.
                {booking.no_show_pm_id
                  ? ' The no-show fee will be charged to their saved card if a policy is configured.'
                  : ' No card is on file — collect any fee manually if applicable.'}
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setShowNoShowConfirm(false)}
                disabled={actionLoading}
                className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Go back
              </button>
              <button
                onClick={handleNoShow}
                disabled={actionLoading}
                className="flex-1 rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Processing…' : 'Yes, no-show'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel confirmation modal ── */}
      {showCancelConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-5 bg-black/40">
          <div className="w-full bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 pt-5 pb-2">
              <h3 className="text-sm font-semibold text-stone-800 mb-0.5">Cancel appointment?</h3>
              <p className="text-xs text-stone-500 mb-4">This action cannot be undone.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1.5">Reason for cancellation</label>
                  <select
                    value={cancelReason}
                    onChange={e => { setCancelReason(e.target.value); setCancelOther(''); }}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-[#C9A96E] focus:outline-none transition"
                  >
                    <option value="">Select a reason…</option>
                    <option>Staff unavailable</option>
                    <option>Business closed</option>
                    <option>Schedule conflict</option>
                    <option>Customer requested</option>
                    <option>Other</option>
                  </select>
                </div>
                {cancelReason === 'Other' && (
                  <div>
                    <input
                      type="text"
                      value={cancelOther}
                      onChange={e => setCancelOther(e.target.value.slice(0, 80))}
                      placeholder="Please specify…"
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-[#C9A96E] focus:outline-none transition"
                    />
                    <p className={`text-right text-xs mt-1 ${cancelOther.length >= 70 ? 'text-amber-500' : 'text-stone-400'}`}>{80 - cancelOther.length}</p>
                  </div>
                )}
                {isPaidBooking && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                    <p className="text-xs font-semibold text-amber-800 mb-1">This booking was paid online</p>
                    <p className="text-xs text-amber-700 mb-2">Cancelling will not automatically refund the customer. You must issue the refund manually through your payment provider.</p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={refundAcknowledged} onChange={e => setRefundAcknowledged(e.target.checked)} className="mt-0.5 shrink-0 accent-amber-600" />
                      <span className="text-xs font-medium text-amber-800">I understand and will handle the refund</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={actionLoading}
                className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                onClick={() => { setShowCancelConfirm(false); handleAction('cancelled'); }}
                disabled={actionLoading || !cancelReasonValid}
                className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Toast stack ───────────────────────────────────────────────────
const TOAST_CONFIG = {
  new:         { label: 'Appointment booked',   dot: 'bg-[#C9A96E]' },
  pending:     { label: 'Approval required',    dot: 'bg-amber-400'  },
  cancelled:   { label: 'Booking cancelled',    dot: 'bg-red-400'    },
  rescheduled: { label: 'Booking rescheduled',  dot: 'bg-sky-400'    },
};

function ToastItem({ toast: { id, booking, type }, onDismiss }) {
  const cfg = TOAST_CONFIG[type] || TOAST_CONFIG.new;
  const dateLabel = new Date(booking.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div className="flex items-start gap-3 bg-stone-900 text-white rounded-2xl px-4 py-3.5 shadow-2xl w-72">
      <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} style={{ marginTop: 6 }} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-snug">{cfg.label}</p>
        <p className="text-[11px] text-stone-400 mt-0.5 leading-snug truncate">
          {booking.caller_name || '—'}{booking.date ? ` · ${dateLabel} at ${formatTime(booking.start_time)}` : ''}
        </p>
      </div>
      <button onClick={onDismiss} className="text-stone-500 hover:text-stone-300 transition-colors shrink-0 mt-0.5">
        <X size={13} />
      </button>
    </div>
  );
}

function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  const visible = toasts.slice(-5); // show only the 5 most recent
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-h-[324px] overflow-y-auto">
      {visible.map(t => <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />)}
    </div>
  );
}

function playNotificationSound() {
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(() => {});
  } catch {}
}

// ── Notification helpers ──────────────────────────────────────────
const NOTIF_CONFIG = {
  new:        { label: 'New booking',         dot: 'bg-[#C9A96E]' },
  pending:    { label: 'Pending approval',    dot: 'bg-amber-400'  },
  cancelled:  { label: 'Booking cancelled',   dot: 'bg-red-400'    },
  rescheduled:{ label: 'Booking rescheduled', dot: 'bg-sky-400'    },
  confirmed:  { label: 'Booking confirmed',   dot: 'bg-emerald-400'},
};

function NotifRow({ notif, onClick }) {
  const cfg = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.new;
  const dateLabel = notif.date
    ? new Date(notif.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';
  const timeLabel = notif.startTime ? formatTime(notif.startTime) : '';
  return (
    <button
      onClick={() => onClick(notif)}
      className={`w-full flex items-start gap-3 px-4 py-3 transition-colors text-left border-b border-stone-100 last:border-0 ${notif.unread ? 'bg-stone-50 hover:bg-stone-100' : 'bg-white hover:bg-stone-50'}`}
    >
      {notif.unread && <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-stone-800">{cfg.label}</p>
        <p className="text-[11px] text-stone-500 truncate mt-0.5">
          {notif.callerName}{dateLabel ? ` · ${dateLabel}` : ''}{timeLabel ? ` at ${timeLabel}` : ''}
        </p>
        {notif.type === 'rescheduled' && notif.oldDate && (
          <p className="text-[10px] text-stone-400 mt-0.5">
            From {new Date(notif.oldDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {notif.oldStartTime ? ` at ${formatTime(notif.oldStartTime)}` : ''}
          </p>
        )}
        <p className="text-[10px] text-stone-300 mt-0.5">
          {new Date(notif.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
    </button>
  );
}

// ── Main dashboard ────────────────────────────────────────────────
export default function Dashboard({ session, onSignOut }) {
  const [page, setPage]               = useState('calendar'); // 'calendar' | 'settings'
  const [notifOpen, setNotifOpen]     = useState(false);
  const [notifList, setNotifList]     = useState([]);
  const [notifHasMore, setNotifHasMore] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOffset, setNotifOffset] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const pendingSelectRef              = useRef(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerContainerRef        = useRef(null);
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
  const [newApptSlot, setNewApptSlot] = useState(null);
  const [toasts, setToasts]           = useState([]);
  const toastTimersRef  = useRef({});
  const recentActionsRef = useRef(new Set()); // tracks `${id}:tag` to skip SSE dupes for own actions

  useEffect(() => {
    api.getProfile().then(p => { setProfile(p); setWeekStaffId(session.user.id); }).catch(() => {});
    api.getUnreadCount().then(r => setUnreadCount(r?.count || 0)).catch(() => {});
    api.getStaff().then(res => {
      setStaff((res.staff || []).filter(s => s.status === 'active'));
    }).catch(() => {});
  }, []);

  const staffColumns = profile ? [
    { id: session.user.id, name: profile.name, avatar_url: profile.avatar_url || null, isOwner: true, isToday: isToday(date) },
    ...staff.map(s => ({ id: s.id, name: s.name, avatar_url: s.avatar_url, isOwner: false, isToday: isToday(date) })),
  ] : [];

  // Real-time SSE — single owner stream, token-only dep so it never re-registers on re-renders
  useRealtimeSSE({
    token: session.access_token,
    onEvent: handleSSEEvent,
  });

  // Close notification panel on outside click
  useEffect(() => {
    if (!notifOpen) return;
    function handleClick(e) {
      if (!e.target.closest('[data-notif-panel]')) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  // Close date picker on outside click
  useEffect(() => {
    if (!datePickerOpen) return;
    function handleClick(e) {
      if (!datePickerContainerRef.current?.contains(e.target)) setDatePickerOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [datePickerOpen]);

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
      // Auto-select booking if navigated from notification
      if (pendingSelectRef.current) {
        const bookingId = pendingSelectRef.current;
        pendingSelectRef.current = null;
        setTimeout(() => {
          setBookings(prev => {
            const found = prev.find(b => b.id === bookingId);
            if (found) {
              setSelected(found);
              setTimeout(() => {
                const el = document.querySelector(`[data-booking-id="${bookingId}"]`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 50);
            }
            return prev;
          });
        }, 0);
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
    setNewApptSlot(null);
    setBookings([]);
    setLoading(true);
  }

  function handleBookingUpdated(updatedBooking) {
    if (!updatedBooking?.id) {
      setSelected(null);
      load(date, view);
      return;
    }
    // Suppress the SSE echo for this action
    markRecentAction(updatedBooking.id, updatedBooking.status);

    // Cancelled: remove from calendar and close panel
    if (updatedBooking.status === 'cancelled') {
      setBookings(prev => prev.filter(b => b.id !== updatedBooking.id));
      setSelected(null);
      return;
    }

    // Reschedule (date or time changed): reload since the block moved on the grid
    if (selected && (updatedBooking.date !== selected.date || updatedBooking.start_time !== selected.start_time)) {
      setSelected(null);
      load(date, view);
      return;
    }

    // Status-only change (approve, no-show): merge in-place — no flicker, panel stays open
    setBookings(prev => prev.map(b =>
      b.id === updatedBooking.id ? { ...b, status: updatedBooking.status } : b
    ));
    setSelected(prev => prev ? { ...prev, status: updatedBooking.status } : null);
  }

  // ── Toast helpers ─────────────────────────────────────────────
  function showToast(booking, type = 'new') {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, booking, type }]);
    toastTimersRef.current[id] = setTimeout(() => dismissToast(id), 4000);
  }

  function dismissToast(id) {
    clearTimeout(toastTimersRef.current[id]);
    delete toastTimersRef.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  // Mark a recent action so the SSE handler ignores it (avoids double sound/toast)
  function markRecentAction(bookingId, tag) {
    const key = `${bookingId}:${tag}`;
    recentActionsRef.current.add(key);
    setTimeout(() => recentActionsRef.current.delete(key), 6000);
  }

  // ── Silent background refresh ────────────────────────────────
  // Fetches fresh booking data for the current view without showing the spinner.
  async function silentRefresh() {
    try {
      if (view === 'month') {
        const from = toDateStr(new Date(date.getFullYear(), date.getMonth(), 1));
        const to   = toDateStr(new Date(date.getFullYear(), date.getMonth() + 1, 0));
        const counts = await api.getMonthlyBookingCounts(from, to);
        setMonthCounts(counts || {});
      } else if (view === 'week') {
        const days = getWeekDays(date);
        const res = await api.getBookings({ from: days[0], to: days[6], page_size: 500 });
        setBookings((res.bookings || []).filter(b => b.status !== 'cancelled'));
      } else {
        const res = await api.getBookings({ from: toDateStr(date), to: toDateStr(date), page_size: 500 });
        setBookings((res.bookings || []).filter(b => b.status !== 'cancelled'));
      }
    } catch {}
  }

  // ── SSE event handler ────────────────────────────────────────
  function handleSSEEvent(payload) {
    const { eventType, new: nb, old: ob } = payload;
    const visibleDates = view === 'week' ? getWeekDays(date) : [toDateStr(date)];

    if (eventType === 'INSERT') {
      if (recentActionsRef.current.has(`${nb?.id}:insert`)) return; // own creation
      playNotificationSound();
      showToast(nb, nb?.status === 'pending' ? 'pending' : 'new');
      setUnreadCount(c => c + 1);
      setNotifList(prev => [{
        id: `${nb?.id || 'unknown'}-${Date.now()}`,
        type: nb?.status === 'pending' ? 'pending' : 'new',
        bookingId: nb?.id,
        callerName: nb?.caller_name || 'Guest',
        date: nb?.date,
        startTime: nb?.start_time?.slice(0, 5),
        oldDate: null,
        oldStartTime: null,
        createdAt: new Date().toISOString(),
        unread: true,
      }, ...prev]);
      if (nb?.date && visibleDates.includes(nb.date)) silentRefresh();

    } else if (eventType === 'UPDATE') {
      const newStatus = nb?.status;
      const oldStatus = ob?.status;
      if (recentActionsRef.current.has(`${nb?.id}:${newStatus}`)) return; // own action

      if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
        showToast(nb, 'cancelled');
        setUnreadCount(c => c + 1);
        setNotifList(prev => [{
          id: `${nb?.id || 'unknown'}-${Date.now()}`,
          type: 'cancelled',
          bookingId: nb?.id,
          callerName: nb?.caller_name || 'Guest',
          date: nb?.date,
          startTime: nb?.start_time?.slice(0, 5),
          oldDate: null,
          oldStartTime: null,
          createdAt: new Date().toISOString(),
          unread: true,
        }, ...prev]);
        setBookings(prev => prev.filter(b => b.id !== nb.id));
        if (selected?.id === nb.id) setSelected(null);

      } else if (nb?.date !== ob?.date || nb?.start_time !== ob?.start_time) {
        playNotificationSound();
        showToast(nb, 'rescheduled');
        setUnreadCount(c => c + 1);
        setNotifList(prev => [{
          id: `${nb?.id || 'unknown'}-${Date.now()}`,
          type: 'rescheduled',
          bookingId: nb?.id,
          callerName: nb?.caller_name || 'Guest',
          date: nb?.date,
          startTime: nb?.start_time?.slice(0, 5),
          oldDate: ob?.date || null,
          oldStartTime: ob?.start_time?.slice(0, 5) || null,
          createdAt: new Date().toISOString(),
          unread: true,
        }, ...prev]);
        const affected = [nb?.date, ob?.date].filter(Boolean);
        if (affected.some(d => visibleDates.includes(d))) silentRefresh();
      }
    }
  }

  async function openNotifPanel() {
    setNotifOpen(true);
    if (notifList.length > 0) return; // already loaded
    setNotifLoading(true);
    try {
      const res = await api.getNotificationHistory(0, 20);
      const snap = unreadCount; // how many newest items are unread
      const notifications = (res.notifications || []).map((n, i) => ({ ...n, unread: i < snap }));
      setNotifList(notifications);
      setNotifHasMore(res.hasMore || false);
      setNotifOffset(20);
    } catch {}
    setNotifLoading(false);
  }

  async function loadMoreNotifs() {
    if (notifLoading || !notifHasMore) return;
    setNotifLoading(true);
    try {
      const res = await api.getNotificationHistory(notifOffset, 20);
      setNotifList(prev => [...prev, ...(res.notifications || [])]);
      setNotifHasMore(res.hasMore || false);
      setNotifOffset(prev => prev + 20);
    } catch {}
    setNotifLoading(false);
  }

  function handleNotifClick(notif) {
    setNotifOpen(false);
    if (notif.unread) {
      setNotifList(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
      setUnreadCount(c => Math.max(0, c - 1));
      api.decrementUnreadCount().catch(() => {});
    }
    setPage('calendar');
    if (!notif.date) return;
    const target = new Date(notif.date + 'T00:00:00');
    setDate(target);
    setView('day');
    if (notif.bookingId) pendingSelectRef.current = notif.bookingId;
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
        {/* Notification bell */}
        <div className="relative" style={{ WebkitAppRegion: 'no-drag' }} data-notif-panel>
          <button
            onClick={() => notifOpen ? setNotifOpen(false) : openNotifPanel()}
            className={`p-1.5 rounded-lg transition-colors ${notifOpen ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}
            title="Notifications"
          >
            <Bell size={14} />
          </button>
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#C9A96E] rounded-full flex items-center justify-center px-1 pointer-events-none">
              <span className="text-[9px] font-bold text-stone-900 leading-none">{unreadCount > 99 ? '99+' : unreadCount}</span>
            </div>
          )}
          {/* Dropdown panel */}
          {notifOpen && (
            <div className="absolute right-0 top-9 w-80 bg-white rounded-2xl shadow-2xl border border-stone-200 z-50 overflow-hidden flex flex-col h-[384px]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 shrink-0">
                <p className="text-sm font-semibold text-stone-800">Notifications</p>
                <button onClick={() => setNotifOpen(false)} className="text-stone-400 hover:text-stone-600 transition-colors">
                  <X size={13} />
                </button>
              </div>
              <div
                className="overflow-y-auto flex-1"
                onScroll={e => {
                  const el = e.currentTarget;
                  if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) loadMoreNotifs();
                }}
              >
                {notifLoading && notifList.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-4 h-4 border-2 border-stone-200 border-t-[#C9A96E] rounded-full animate-spin" />
                  </div>
                ) : notifList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <Bell size={24} className="text-stone-200 mb-2" />
                    <p className="text-xs text-stone-400">No notifications yet</p>
                  </div>
                ) : (
                  <>
                    {notifList.map(n => <NotifRow key={n.id} notif={n} onClick={handleNotifClick} />)}
                    {notifHasMore && (
                      <div className="flex items-center justify-center py-3">
                        {notifLoading
                          ? <div className="w-4 h-4 border-2 border-stone-200 border-t-[#C9A96E] rounded-full animate-spin" />
                          : <button onClick={loadMoreNotifs} className="text-xs text-stone-400 hover:text-stone-600">Load more</button>
                        }
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="px-4 py-2 border-t border-stone-100 shrink-0">
                <p className="text-[10px] text-stone-400 text-center">Notifications auto-clear after 48 hours.</p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setPage(p => p === 'settings' ? 'calendar' : 'settings')}
          className={`p-1.5 rounded-lg transition-colors ${page === 'settings' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}
          title="Settings"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <SettingsIcon size={14} />
        </button>
        <button
          onClick={onSignOut}
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          title="Sign out"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <LogOut size={14} />
        </button>
      </div>

      {/* Settings page */}
      {page === 'settings' && (
        <Settings
          onBack={() => setPage('calendar')}
          slug={profile?.is_staff_member ? profile?.owner_booking_slug : profile?.booking_slug}
          profile={profile}
        />
      )}

      {/* Toolbar */}
      {page === 'calendar' &&
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

        <div ref={datePickerContainerRef} className="relative">
          <button
            onClick={() => setDatePickerOpen(o => !o)}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-stone-100 transition-colors"
          >
            <CalendarDays size={13} className="text-stone-400" />
            <h1 className="text-xs font-semibold text-stone-700">
              {view === 'week' ? formatWeekHeading(date) : view === 'month' ? formatMonthHeading(date) : formatHeading(date)}
            </h1>
          </button>
          {datePickerOpen && (
            <div className="absolute top-full left-0 mt-2 z-50">
              <DatePickerPopup
                value={date}
                onChange={d => { setDate(d); setDatePickerOpen(false); }}
                onClose={() => setDatePickerOpen(false)}
              />
            </div>
          )}
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
      </div>}

      {/* Body */}
      {page === 'calendar' &&
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
              onSelectBooking={(b) => { setSelected(b); setNewApptSlot(null); }}
              onSlotClick={(slot) => { setNewApptSlot({ ...slot, userId: weekStaffId || session.user.id }); setSelected(null); }}
            />

          ) : (
            staffColumns.length > 0
              ? <StaffDayGrid
                  columns={staffColumns}
                  bookings={bookings}
                  selected={selected}
                  onSelectBooking={(b) => { setSelected(b); setNewApptSlot(null); }}
                  staffPage={staffPage}
                  setStaffPage={setStaffPage}
                  date={toDateStr(date)}
                  onSlotClick={(slot) => { setNewApptSlot(slot); setSelected(null); }}
                />
              : <div className="flex-1 flex items-center justify-center"><div className="w-5 h-5 border-2 border-stone-200 border-t-[#C9A96E] rounded-full animate-spin" /></div>
          )}
        </div>

        {/* Always-visible right panel */}
        <RightPanel
          booking={selected}
          newApptSlot={newApptSlot}
          newApptDayBookings={newApptSlot ? bookings.filter(b =>
            b.user_id === newApptSlot.userId &&
            b.date === newApptSlot.date &&
            b.status !== 'cancelled' && b.status !== 'no_show'
          ) : []}
          bookings={view === 'week' && weekStaffId ? bookings.filter(b => b.user_id === weekStaffId) : bookings}
          monthCounts={monthCounts}
          staffColumns={staffColumns}
          date={date}
          view={view}
          loading={loading}
          ownerUserId={session.user.id}
          onClose={() => setSelected(null)}
          onUpdated={handleBookingUpdated}
          onNewApptClose={() => setNewApptSlot(null)}
          onNewApptCreated={(newBooking) => {
            setNewApptSlot(null);
            playNotificationSound();
            showToast(newBooking, 'new');
            if (newBooking?.id) markRecentAction(newBooking.id, 'insert');
            if (!newBooking?.id) { load(date, view); return; }
            // Only merge into the visible bookings if the booking's date
            // is actually shown in the current view — otherwise just close silently.
            const visibleDates = view === 'week' ? weekDays : [toDateStr(date)];
            if (visibleDates.includes(newBooking.date)) {
              setBookings(prev => [...prev, newBooking]);
            }
            // If it's on a different date, do nothing — user will see it when they navigate there.
          }}
        />
      </div>}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
