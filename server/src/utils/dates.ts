// Viewing appointments use India Standard Time, because every property is in India.
// Dates are stored as "YYYY-MM-DD" and times as "HH:mm" (property's local time).

export const TIME_ZONE = 'Asia/Kolkata';

/** Viewing slots: 10:00 to 18:00, every 30 minutes */
export const VIEWING_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let minutes = 10 * 60; minutes <= 18 * 60; minutes += 30) {
    slots.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
  }
  return slots;
})();

export const MAX_DAYS_AHEAD = 60;

/** Current date and time in India: { date: "2026-11-16", time: "14:05" } */
export function nowInIndia(now = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function addDaysToDateString(value: string, days: number): string {
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Is this slot in the past (India time)? */
export function isPastSlot(date: string, time: string, now = new Date()): boolean {
  const current = nowInIndia(now);
  return date < current.date || (date === current.date && time <= current.time);
}

export function formatDateForHumans(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

export function formatTimeForHumans(time: string): string {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}
