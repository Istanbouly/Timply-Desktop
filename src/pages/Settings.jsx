import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { ChevronLeft } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

// ── Helpers ───────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES      = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_LABELS = { 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', '-1': 'Last' };

function formatTime12(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function resolveFloatingDay(year, month, week, weekday) {
  if (week === -1) {
    const lastDay = new Date(year, month, 0).getDate();
    const lastDow = new Date(year, month - 1, lastDay).getDay();
    return lastDay - ((lastDow - weekday + 7) % 7);
  }
  const firstDow = new Date(year, month - 1, 1).getDay();
  return 1 + ((weekday - firstDow + 7) % 7) + (week - 1) * 7;
}

// Returns "January 20" (or "January 1" for fixed)
function formatHolidayDate(h) {
  const year = new Date().getFullYear();
  if (h.week != null && h.weekday != null) {
    const day = resolveFloatingDay(year, h.month, h.week, h.weekday);
    return `${MONTH_NAMES[h.month - 1]} ${day}`;
  }
  return `${MONTH_NAMES[h.month - 1]} ${h.day}`;
}

// Returns "Third Monday of January" for floating, null for fixed
function formatHolidayRule(h) {
  if (h.week != null && h.weekday != null) {
    return `${WEEK_LABELS[h.week]} ${WEEKDAY_NAMES[h.weekday]} of ${MONTH_NAMES_FULL[h.month - 1]}`;
  }
  return null;
}

function formatDuration(mins) {
  if (!mins) return '—';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatPrice(cents) {
  if (!cents && cents !== 0) return 'Free';
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}`;
}

// ── Inner tab bar ─────────────────────────────────────────────────

const TABS = ['Working Hours', 'Holidays', 'Services', 'Booking Settings'];

// ── Sub-views ─────────────────────────────────────────────────────

function AvailabilityTab({ data, loading }) {
  if (loading) return <Spinner />;
  if (!data?.length) return <Empty text="No availability settings found." />;

  // Ensure sorted Sun → Sat
  const sorted = [...data].sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
      {sorted.map(row => (
        <div key={row.day_of_week} className="flex items-center gap-4 py-3 px-4 hover:bg-stone-100 transition-colors cursor-default">
          <span className="w-28 text-sm font-medium text-stone-700">{DAY_NAMES[row.day_of_week]}</span>
          {row.enabled ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-sm text-stone-600">
                {formatTime12(row.start_time)} – {formatTime12(row.end_time)}
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-stone-300 shrink-0" />
              <span className="text-sm text-stone-400">Closed</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function HolidaysTab({ data, loading }) {
  if (loading) return <Spinner />;
  if (!data?.length) return <Empty text="No holidays configured." />;

  const currentYear = new Date().getFullYear();

  return (
    <div className="flex gap-48 items-start">
      <div className="w-96 shrink-0">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">{currentYear} Holidays</h2>
      <div className="divide-y divide-stone-100">
      {data.map(h => {
        const rule = formatHolidayRule(h);
        return (
          <div key={h.id} className="flex items-center gap-4 py-3 px-2 rounded-lg hover:bg-stone-100 transition-colors cursor-default">
            <div className="flex-1">
              <p className="text-sm font-medium text-stone-700">{h.name}</p>
              {rule && <p className="text-[11px] text-stone-400 mt-0.5">{rule}</p>}
            </div>
            <span className="text-sm text-stone-500 shrink-0">{formatHolidayDate(h)}</span>
          </div>
        );
      })}
      </div>
      </div>

      {/* Info card — right side */}
      <div className="w-72 shrink-0 bg-stone-900 rounded-2xl px-4 py-4 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-[#C9A96E] shrink-0" />
          <p className="text-xs font-semibold text-white">Business-wide closures</p>
        </div>
        <p className="text-[11px] text-stone-400 leading-relaxed">
          Holidays block bookings for <span className="text-stone-300 font-medium">all staff</span> on those dates. To manage holidays or pause your calendar, log in at{' '}
          <span className="text-[#C9A96E] font-medium">timply.ai</span> as the owner account.
        </p>
      </div>
    </div>
  );
}

function ServicesTab({ data, loading }) {
  if (loading) return <Spinner />;
  if (!data?.length) return <Empty text="No services found." />;

  return (
    <div className="grid gap-3">
      {data.map(svc => (
        <div key={svc.id} className="rounded-xl border border-stone-200 bg-white p-4 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-stone-800 truncate">{svc.name}</span>
              {!svc.active && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">Inactive</span>
              )}
            </div>
            {svc.description && (
              <p className="text-xs text-stone-500 mb-2 line-clamp-2">{svc.description}</p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <Pill label="Duration" value={formatDuration(svc.duration_minutes)} />
              {svc.buffer_minutes > 0 && <Pill label="Buffer" value={formatDuration(svc.buffer_minutes)} />}
              <Pill label="Price" value={formatPrice(svc.price_cents)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Read-only toggle ──────────────────────────────────────────────
function ReadOnlyToggle({ checked }) {
  return (
    <div className="relative shrink-0 cursor-not-allowed">
      <div className={`w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[#C9A96E]' : 'bg-stone-300'}`} />
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mt-7 mb-1 first:mt-0">{children}</p>
  );
}

function SettingRow({ label, description, checked, children, last }) {
  return (
    <div className={`flex items-start justify-between gap-6 py-4 px-5 hover:bg-stone-100 transition-colors cursor-default ${!last ? 'border-b border-stone-100' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800">{label}</p>
        <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">{description}</p>
        {children}
      </div>
      <ReadOnlyToggle checked={!!checked} />
    </div>
  );
}

function PolicyDetail({ label, value }) {
  return (
    <div className="mt-2 pl-0 flex items-center gap-2">
      <span className="text-[11px] text-stone-400">{label}:</span>
      <span className="text-[11px] font-medium text-stone-600">{value}</span>
    </div>
  );
}

function formatFee(type, amount) {
  if (!amount) return 'None';
  if (type === 'percent') return `${amount}% of service price`;
  return `$${(amount / 100).toFixed(2)}`;
}

const REFUND_LABELS = {
  no_refunds:     'No refunds',
  within_24h:     'Refunds within 24 hours',
  within_48h:     'Refunds within 48 hours',
  within_72h:     'Refunds within 72 hours',
  within_1_week:  'Refunds within 1 week',
  custom:         'Custom policy',
};

function BookingSettingsTab({ profile }) {
  if (!profile) return <Spinner />;

  const p = profile;

  return (
    <div className="w-full">

      {/* Scheduling */}
      <SectionLabel>Scheduling</SectionLabel>
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <SettingRow
          label="Auto-confirm appointments"
          description="When enabled, new bookings are instantly confirmed. When disabled, they stay pending until you approve them manually."
          checked={p.auto_confirm !== false}
          last
        />
      </div>

      {/* Booking policies */}
      <SectionLabel>Booking Policies</SectionLabel>
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <SettingRow
          label="Cancellation policy"
          description="Charge customers who cancel within a set window before their appointment. Requires a Stripe account to be connected."
          checked={!!p.cancellation_policy_enabled}
        >
          {p.cancellation_policy_enabled && (
            <div className="mt-2 border-l-2 border-stone-200 pl-3 space-y-1">
              <PolicyDetail label="Free cancellation window" value={`${p.cancellation_policy_hours ?? 24} hours before appointment`} />
              <PolicyDetail label="Fee" value={formatFee(p.cancellation_fee_type, p.cancellation_fee_amount)} />
            </div>
          )}
        </SettingRow>
        <SettingRow
          label="No-show policy"
          description="Charge customers who don't show up for their appointment. When enabled, only registered customers can book (a saved card is required at booking time)."
          checked={!!p.no_show_policy_enabled}
        >
          {p.no_show_policy_enabled && (
            <div className="mt-2 border-l-2 border-stone-200 pl-3 space-y-1">
              <PolicyDetail label="Fee" value={formatFee(p.no_show_fee_type, p.no_show_fee_amount)} />
            </div>
          )}
        </SettingRow>
        <div className="flex items-start justify-between gap-6 py-4 px-5 hover:bg-stone-100 transition-colors cursor-default">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-800">Refund policy</p>
            <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">Shown to customers on your booking page before they book.</p>
            {p.refund_policy && (
              <span className="inline-block mt-2 text-[11px] font-medium text-stone-600 bg-stone-100 rounded-md px-2 py-0.5">
                {REFUND_LABELS[p.refund_policy] || p.refund_policy}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Multi-service */}
      <SectionLabel>Multi-Service</SectionLabel>
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <SettingRow
          label="Allow multi-service booking"
          description="When enabled, customers can select multiple services in a single booking. The total appointment time is calculated automatically."
          checked={!!p.allow_multi_service}
          last={!p.allow_multi_service}
        />
        {p.allow_multi_service && (
          <div className="flex items-center justify-between gap-6 py-4 px-5 border-t border-stone-100">
            <div className="flex-1 min-w-0 pl-1">
              <p className="text-sm font-medium text-stone-800">Max services per booking</p>
              <p className="text-xs text-stone-400 mt-0.5">Maximum number of services a customer can select in a single booking.</p>
            </div>
            <div className="shrink-0 w-8 h-8 rounded-full border border-stone-200 flex items-center justify-center text-sm font-bold text-stone-700 bg-stone-50">
              {p.max_services_per_booking ?? 5}
            </div>
          </div>
        )}
      </div>

      {/* Notifications */}
      <SectionLabel>Notifications</SectionLabel>
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <SettingRow
          label="Booking notifications"
          description="Show a toast notification on the dashboard when a new booking arrives."
          checked={p.notifications_enabled !== false}
          last={p.notifications_enabled === false}
        />
        {p.notifications_enabled !== false && (
          <SettingRow
            label="Notification sound"
            description="Play a chime when a new booking notification arrives."
            checked={p.notification_sound !== false}
            last
          />
        )}
      </div>

    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────

function Pill({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-stone-100 rounded-md px-2 py-0.5">
      <span className="text-stone-400">{label}</span>
      <span className="font-medium text-stone-700">{value}</span>
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-5 h-5 rounded-full border-2 border-stone-200 border-t-[#C9A96E] animate-spin" />
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm text-stone-400">{text}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_BASE || '';

function buildPortalUrl(slug) {
  if (!slug) return null;
  if (BASE.includes('localhost')) return `http://${slug}.timply.localhost:3002/login`;
  if (BASE.includes('staging'))   return `https://${slug}.staging.timply.ai/login`;
  return `https://${slug}.timply.ai/login`;
}

export default function Settings({ onBack, slug, profile }) {
  const [activeTab, setActiveTab] = useState('Working Hours');
  const [availability, setAvailability] = useState(null);
  const [holidays, setHolidays] = useState(null);
  const [services, setServices] = useState(null);
  const [loading, setLoading] = useState({});

  function setTabLoading(tab, val) {
    setLoading(prev => ({ ...prev, [tab]: val }));
  }

  useEffect(() => {
    // Fetch all three data sets in parallel on mount
    setTabLoading('Working Hours', true);
    setTabLoading('Holidays', true);
    setTabLoading('Services', true);

    api.getAvailabilitySettings()
      .then(setAvailability)
      .catch(() => setAvailability([]))
      .finally(() => setTabLoading('Working Hours', false));

    api.getHolidays()
      .then(setHolidays)
      .catch(() => setHolidays([]))
      .finally(() => setTabLoading('Holidays', false));

    api.getEventTypes()
      .then(setServices)
      .catch(() => setServices([]))
      .finally(() => setTabLoading('Services', false));
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#FAFAF8]">

      {/* Inner tab bar */}
      <div className="h-11 bg-white border-b border-stone-200 flex items-center px-5 gap-1 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 mr-2 text-stone-400 hover:text-stone-700 transition-colors"
        >
          <ChevronLeft size={14} />
          <span className="text-[11px] font-medium">Back</span>
        </button>
        <div className="w-px h-4 bg-stone-200 mr-1" />
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              activeTab === tab
                ? 'bg-stone-900 text-white'
                : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-stone-800">{activeTab}</h1>
            <p className="text-xs text-stone-400 mt-1">
              {activeTab === 'Working Hours'    && 'Your weekly schedule — days and hours you accept bookings.'}
              {activeTab === 'Holidays'         && 'Dates your business is closed. Bookings are blocked for all staff on these days.'}
              {activeTab === 'Services'         && 'Appointment types available on your booking page.'}
              {activeTab === 'Booking Settings' && 'Configuration for how your booking page behaves.'}
            </p>
          </div>
          {activeTab === 'Working Hours'    && <AvailabilityTab   data={availability} loading={loading['Working Hours']} />}
          {activeTab === 'Holidays'         && <HolidaysTab       data={holidays}     loading={loading['Holidays']} />}
          {activeTab === 'Services'         && <ServicesTab       data={services}     loading={loading['Services']} />}
          {activeTab === 'Booking Settings' && <BookingSettingsTab profile={profile} />}
        </div>
      </div>

      {/* Read-only note */}
      <div className="shrink-0 bg-stone-900 px-5 py-3 flex items-center gap-3">
        <div className="w-1.5 h-1.5 rounded-full bg-[#C9A96E] shrink-0" />
        <p className="text-[11px] text-stone-400 flex-1">
          Settings are read-only on the desktop app and can only be changed from the web portal.
        </p>
        {buildPortalUrl(slug) && (
          <button
            onClick={() => invoke('open_url', { url: buildPortalUrl(slug) })}
            className="text-[11px] font-semibold bg-[#C9A96E] hover:bg-[#b8935a] text-stone-900 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            Log in to your portal →
          </button>
        )}
      </div>
    </div>
  );
}
