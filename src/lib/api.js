import { supabase } from './supabase';

const BASE = import.meta.env.VITE_API_BASE;

let _token = null;

export function setToken(token) {
  _token = token;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
  };
}

async function request(method, path, body, isRetry = false) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  // Token expired — refresh once and retry
  if (res.status === 401 && !isRetry) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      _token = data.session.access_token;
      return request(method, path, body, true);
    }
    // Refresh failed — session is dead, sign out
    await supabase.auth.signOut();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getProfile: ()                    => request('GET',  '/profile'),
  getBookings: (params = {})        => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/bookings${q ? '?' + q : ''}`);
  },
  getMonthlyBookingCounts: (from, to) =>
    request('GET', `/bookings/monthly-counts?from=${from}&to=${to}`),
  getAvailabilitySettings: ()       => request('GET',  '/availability'),
  getStaff: ()                      => request('GET',  '/staff'),
  updateBooking: (id, data)         => request('PATCH', `/bookings/${id}`, data),
  getBookingNotes:    (id)          => request('GET',  `/bookings/${id}/notes`),
  addBookingNote:     (id, body)    => request('POST', `/bookings/${id}/notes`, { body }),
  getBookingPayment:  (id)          => request('GET',  `/bookings/${id}/payment`),
  getBookingPolicies: (id)          => request('GET',  `/bookings/${id}/policies`),
};
