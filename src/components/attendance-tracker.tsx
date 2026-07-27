'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const PING_INTERVAL_MS = 60_000; // send a heartbeat at most once a minute

interface AttendanceDay {
  clockInAt: string | null;
  clockOutAt: string | null;
  breakStartAt: string | null;
  breakEndAt: string | null;
  status: string | null;
}

interface StatusResponse {
  day: AttendanceDay;
  onBreak: boolean;
  breakMinutesUsed: number;
  breakMinutesRemaining: number;
  missingMinutesToday: number;
}

export default function AttendanceTracker() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const lastPingSentRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance');
      if (res.ok) setStatus(await res.json());
    } catch {
      // silent — this is a background widget, not a critical path
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Track mouse/keyboard activity and send a throttled heartbeat while
  // clocked in. A ping is only sent if there was genuine activity since the
  // last one — going idle simply means the pings stop, which is exactly
  // what server-side gap detection needs.
  useEffect(() => {
    function markActive() {
      lastActivityRef.current = Date.now();
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

    const interval = setInterval(() => {
      const now = Date.now();
      const wasActiveRecently = now - lastActivityRef.current < PING_INTERVAL_MS;
      const dueForPing = now - lastPingSentRef.current >= PING_INTERVAL_MS;

      if (wasActiveRecently && dueForPing && status?.day.clockInAt && !status.day.clockOutAt) {
        lastPingSentRef.current = now;
        fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ping' }),
        }).catch(() => {});
      }
    }, 15_000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
  }, [status]);

  // Periodically refresh the displayed status (missing minutes, break clock).
  useEffect(() => {
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function runAction(action: 'clock-in' | 'clock-out' | 'break-start' | 'break-end') {
    setError(null);
    setLoading(true);
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Something went wrong');
      return;
    }
    refresh();
  }

  if (!status) return null;

  const { day, onBreak, breakMinutesUsed, breakMinutesRemaining, missingMinutesToday } = status;
  const isClockedIn = Boolean(day.clockInAt && !day.clockOutAt);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-sm font-medium text-gray-700">
        {day.clockOutAt
          ? `Clocked out at ${new Date(day.clockOutAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`
          : day.clockInAt
            ? `Clocked in at ${new Date(day.clockInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`
            : 'Not clocked in yet'}
      </span>

      {day.status === 'LATE' && (
        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">Late</span>
      )}

      {!day.clockInAt && (
        <button
          onClick={() => runAction('clock-in')}
          disabled={loading}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Clock in
        </button>
      )}

      {isClockedIn && !onBreak && (
        <>
          <button
            onClick={() => runAction('break-start')}
            disabled={loading || breakMinutesRemaining <= 0}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Start break ({breakMinutesRemaining}m left)
          </button>
          <button
            onClick={() => runAction('clock-out')}
            disabled={loading}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Clock out
          </button>
        </>
      )}

      {onBreak && (
        <button
          onClick={() => runAction('break-end')}
          disabled={loading}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          End break
        </button>
      )}

      {isClockedIn && (
        <span className="text-xs text-gray-400">
          Break used: {breakMinutesUsed}m
          {missingMinutesToday > 0 ? ` · Idle time flagged: ${missingMinutesToday}m` : ''}
        </span>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
