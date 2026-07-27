// Shift rules: 10:00–16:00 IST, break capped at 60 minutes, idle >5 min = "missing".
//
// IMPORTANT: all shift/day boundaries are computed in India Standard Time
// (UTC+5:30, no daylight saving) regardless of what timezone the server
// process itself runs in — Vercel's functions run in UTC by default, so
// naive `Date.setHours()` would treat "10:00" as 10:00 UTC (i.e. 3:30 PM
// IST), not 10:00 AM IST. The helpers below convert explicitly instead of
// relying on the server's local timezone.

export const SHIFT_START_HOUR = 10; // 10:00 AM IST
export const SHIFT_END_HOUR = 16; // 4:00 PM IST
export const MAX_BREAK_MINUTES = 60;
export const IDLE_THRESHOLD_MINUTES = 5;
export const LATE_GRACE_MINUTES = 0; // clock-in after 10:00 IST sharp counts as late

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Given a real instant, returns a Date whose UTC getters (getUTCHours,
 * getUTCDate, etc.) reflect India's wall-clock time at that instant.
 * Only ever read this with getUTC* methods — its own "instant" is not
 * meaningful, it's just a carrier for IST wall-clock components.
 */
function toIstWallClock(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/** Reverses toIstWallClock: turns IST wall-clock components (built via Date.UTC) back into the real instant. */
function fromIstWallClock(istWallClock: Date): Date {
  return new Date(istWallClock.getTime() - IST_OFFSET_MS);
}

export function startOfDay(date: Date): Date {
  const wall = toIstWallClock(date);
  const istMidnight = new Date(
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), 0, 0, 0, 0)
  );
  return fromIstWallClock(istMidnight);
}

export function getShiftWindow(date: Date): { start: Date; end: Date } {
  const wall = toIstWallClock(date);
  const y = wall.getUTCFullYear();
  const m = wall.getUTCMonth();
  const d = wall.getUTCDate();
  const start = fromIstWallClock(new Date(Date.UTC(y, m, d, SHIFT_START_HOUR, 0, 0, 0)));
  const end = fromIstWallClock(new Date(Date.UTC(y, m, d, SHIFT_END_HOUR, 0, 0, 0)));
  return { start, end };
}

export function isLateClockIn(clockInAt: Date): boolean {
  const shiftStart = getShiftWindow(clockInAt).start;
  return clockInAt.getTime() > shiftStart.getTime() + LATE_GRACE_MINUTES * 60000;
}

export interface MissingInterval {
  start: Date;
  end: Date;
  minutes: number;
}

/**
 * Walks the sequence of activity pings across a window (shift start/now or
 * clock-out, whichever is earlier) and returns every gap longer than the
 * idle threshold. Gaps that fall entirely inside the declared break are
 * excluded.
 */
export function computeMissingIntervals(params: {
  pings: Date[];
  windowStart: Date;
  windowEnd: Date;
  breakStart?: Date | null;
  breakEnd?: Date | null;
}): MissingInterval[] {
  const { pings, windowStart, windowEnd, breakStart, breakEnd } = params;
  if (windowEnd <= windowStart) return [];

  const sorted = [...pings]
    .filter((p) => p >= windowStart && p <= windowEnd)
    .sort((a, b) => a.getTime() - b.getTime());

  const points = [windowStart, ...sorted, windowEnd];
  const gaps: MissingInterval[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const minutes = (to.getTime() - from.getTime()) / 60000;
    if (minutes <= IDLE_THRESHOLD_MINUTES) continue;

    // Skip gaps that sit entirely within the declared break window.
    if (breakStart && breakEnd && from >= breakStart && to <= breakEnd) continue;

    gaps.push({ start: from, end: to, minutes: Math.round(minutes) });
  }

  return gaps;
}

export function sumMinutes(intervals: MissingInterval[]): number {
  return intervals.reduce((sum, i) => sum + i.minutes, 0);
}
