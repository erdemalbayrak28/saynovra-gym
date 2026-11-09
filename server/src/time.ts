// Events are stored as UTC ISO timestamps. Memberships use calendar days in the gym's time zone
// ("YYYY-MM-DD"), because "valid until the 12th" means the gym's 12th, not UTC's.

const DAY_MS = 24 * 60 * 60 * 1000;
const formatters = new Map<string, Intl.DateTimeFormat>();

export function localDate(at: Date, timeZone: string): string {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(timeZone, formatter);
  }
  return formatter.format(at);
}

function dateToUtcMs(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) throw new Error(`Invalid calendar date: ${isoDate}`);
  return Date.UTC(year, month - 1, day);
}

export function addDays(isoDate: string, days: number): string {
  return new Date(dateToUtcMs(isoDate) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((dateToUtcMs(to) - dateToUtcMs(from)) / DAY_MS);
}

export function hoursAgo(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

/** UTC instant of local midnight for `now`'s calendar day in `timeZone`. */
export function startOfLocalDay(now: Date, timeZone: string): string {
  return startOfLocalDate(localDate(now, timeZone), timeZone);
}

/** UTC instant of local midnight of a calendar date in `timeZone`. */
export function startOfLocalDate(isoDate: string, timeZone: string): string {
  const midnightUtc = dateToUtcMs(isoDate);
  const noon = new Date(midnightUtc + 12 * 60 * 60 * 1000);
  return new Date(midnightUtc - offsetMinutes(noon, timeZone) * 60 * 1000).toISOString();
}

const WEEKDAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const hourFormatters = new Map<string, Intl.DateTimeFormat>();

/** Hour of day (0-23) in `timeZone`. */
export function localHour(at: Date, timeZone: string): number {
  let formatter = hourFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' });
    hourFormatters.set(timeZone, formatter);
  }
  return Number(formatter.format(at));
}

export function weekdayName(isoDate: string): string {
  return WEEKDAY_NAMES[new Date(dateToUtcMs(isoDate)).getUTCDay()] ?? '';
}

/** Monday of the week containing `isoDate` (weeks start on Monday in Türkiye). */
export function mondayOf(isoDate: string): string {
  const weekday = new Date(dateToUtcMs(isoDate)).getUTCDay();
  return addDays(isoDate, -((weekday + 6) % 7));
}

function offsetMinutes(at: Date, timeZone: string): number {
  const label = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(label ?? '');
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}
