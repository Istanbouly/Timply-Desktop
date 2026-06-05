import { useEffect, useRef } from 'react';

const BASE = import.meta.env.VITE_API_BASE;

/**
 * Opens a single SSE connection on the owner's notification stream.
 * Calls onEvent(payload) for every booking event received.
 *
 * @param {string}   token   - Supabase access token (passed as ?token= query param)
 * @param {Function} onEvent - Called with { eventType, new, old } payloads
 */
export function useRealtimeSSE({ token, onEvent }) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent; // keep ref fresh so the effect never needs to re-run for this

  useEffect(() => {
    if (!token) return;

    const es = new EventSource(`${BASE}/notifications/stream?token=${token}`);

    es.onmessage = (e) => {
      if (!e.data || e.data.startsWith(':')) return; // ignore keep-alive pings
      try {
        const payload = JSON.parse(e.data);
        onEventRef.current?.(payload);
      } catch {}
    };

    es.onerror = () => {}; // EventSource reconnects automatically on network drops

    return () => es.close();
  }, [token]); // only reconnect when the auth token changes
}
