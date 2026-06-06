import { useState, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLES = {
  confirmed: 'bg-emerald-50 text-emerald-700',
  pending:   'bg-amber-50 text-amber-700',
  cancelled: 'bg-stone-100 text-stone-500',
  no_show:   'bg-rose-50 text-rose-600',
  completed: 'bg-slate-100 text-slate-600',
};
const STATUS_LABEL = { confirmed: 'Confirmed', pending: 'Pending', cancelled: 'Cancelled', no_show: 'No Show', completed: 'Completed' };

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState(null);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const activeQueryRef        = useRef('');

  async function fetchPage(q, pageNum) {
    setLoading(true);
    setError('');
    const offset = (pageNum - 1) * PAGE_SIZE;
    try {
      const res = await api.searchCustomer(q, offset, PAGE_SIZE);
      setResults(res.bookings || []);
      setTotal(res.total ?? 0);
      setPage(pageNum);
    } catch (err) {
      setError(err.message || 'Search failed');
    }
    setLoading(false);
  }

  async function search(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    activeQueryRef.current = q;
    setResults(null);
    setTotal(0);
    await fetchPage(q, 1);
  }

  function goToPage(pageNum) {
    fetchPage(activeQueryRef.current, pageNum);
  }

  const totalPages  = Math.ceil(total / PAGE_SIZE);
  const callerName  = results?.[0]?.caller_name;
  const startEntry  = results?.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const endEntry    = results?.length ? (page - 1) * PAGE_SIZE + results.length : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden px-6 py-5">
      <div className="mx-auto max-w-4xl w-full flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="mb-5 shrink-0">
          <h1 className="text-xl font-bold text-stone-800">Customer Search</h1>
          <p className="text-xs text-stone-400 mt-1">Search for a guest by email or phone to view their booking history.</p>
        </div>

        {/* Search bar — always visible */}
        <form onSubmit={search} className="flex gap-2 mb-5 shrink-0">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Email address or phone number…"
              className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#C9A96E] focus:ring-2 focus:ring-[#C9A96E]/10 transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-700 disabled:opacity-40 transition-colors shrink-0"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-600 mb-4 shrink-0">{error}</div>
        )}

        {/* No results */}
        {results !== null && results.length === 0 && !loading && (
          <div className="text-center py-16 text-stone-400">
            <Search size={28} className="mx-auto mb-2 text-stone-200" />
            <p className="text-sm">No bookings found for <span className="font-medium text-stone-600">"{query}"</span></p>
          </div>
        )}

        {/* Results table */}
        {results && results.length > 0 && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Meta row */}
            <div className="flex items-baseline gap-2 mb-3 shrink-0">
              <p className="text-sm font-semibold text-stone-800">{callerName}</p>
              <p className="text-xs text-stone-400">{total} booking{total !== 1 ? 's' : ''}</p>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden flex-1 min-h-0 overflow-y-auto">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2.5 bg-stone-50 border-b border-stone-100">
                <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Date</span>
                <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Service</span>
                <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Status</span>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-stone-400">Loading…</div>
              ) : (
                results.map((b, i) => (
                  <div key={b.id} className={`grid grid-cols-[1fr_auto_auto] gap-4 items-center px-5 py-3.5 ${i > 0 ? 'border-t border-stone-100' : ''}`}>
                    <div>
                      <p className="text-sm font-medium text-stone-800">{formatDate(b.date)}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{formatTime(b.start_time)}</p>
                    </div>
                    <span className="text-xs text-stone-500 whitespace-nowrap">{b.event_types?.name || '—'}</span>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[b.status] || STATUS_STYLES.confirmed}`}>
                      {STATUS_LABEL[b.status] || b.status}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 shrink-0">
                <p className="text-xs text-stone-400">
                  Showing {startEntry}–{endEntry} of {total}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page === 1 || loading}
                    className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === '…' ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-xs text-stone-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => goToPage(p)}
                          disabled={loading}
                          className={`min-w-[28px] h-7 rounded-lg text-xs font-semibold transition-colors ${
                            p === page
                              ? 'bg-stone-900 text-white'
                              : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )
                  }

                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page === totalPages || loading}
                    className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
