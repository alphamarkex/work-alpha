// Shift rules: 10:00–16:00, break capped at 60 minutes, idle >5 min = "missing".

export const SHIFT_START_HOUR = 10; // 10:00 AM
export const SHIFT_END_HOUR = 16; // 4:00 PM
export const MAX_BREAK_MINUTES = 60;
export const IDLE_THRESHOLD_MINUTES = 5;
export const LATE_GRACE_MINUTES = 0; // clock-in after 10:00 sharp counts as late

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getShiftWindow(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(SHIFT_START_HOUR, 0, 0, 0);
  const end = new Date(date);
  end.setHours(SHIFT_END_HOUR, 0, 0, 0);
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
