import { GYM_TIME_ZONE } from './config';

const clockFormat = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: GYM_TIME_ZONE,
});

export function clockTime(iso: string): string {
  return clockFormat.format(new Date(iso));
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function daysLeftText(daysLeft: number | null): string {
  if (daysLeft === null) return '';
  return daysLeft === 0 ? 'Bugün son gün' : `${daysLeft} gün kaldı`;
}

const moneyFormat = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });

export function money(kurus: number): string {
  return moneyFormat.format(kurus / 100);
}

// Membership dates are calendar days ("2026-11-09"); read them as UTC so no time zone shifts the day.
const calendarFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortCalendarFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: GYM_TIME_ZONE,
});

export function calendarDate(isoDate: string, withYear = true): string {
  const at = new Date(`${isoDate}T00:00:00Z`);
  return (withYear ? calendarFormat : shortCalendarFormat).format(at);
}

export function dateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** "5550000001" → "0555 000 00 01" */
export function phone(national: string): string {
  const match = /^(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(national);
  return match ? `0${match[1]} ${match[2]} ${match[3]} ${match[4]}` : national;
}

/** Today's calendar day in the gym's time zone, as "YYYY-MM-DD". */
export function gymToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Whole calendar days from `from` to `to` ("YYYY-MM-DD"); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function addCalendarDays(isoDate: string, days: number): string {
  const at = new Date(`${isoDate}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}
