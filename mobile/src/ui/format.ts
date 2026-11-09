import type { MembershipStatus } from '../../../shared/contract';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** "2026-12-21" -> "21 Aralık 2026". Calendar dates carry no time zone, so no Date parsing. */
export function longDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return `${day} ${MONTHS[month - 1] ?? ''} ${year}`;
}

/** "5 dk önce", "1 sa 10 dk önce"; for timestamps from the server. */
export function minutesAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} sa önce` : `${hours} sa ${rest} dk önce`;
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** "2026-10-12" -> "12 Eki" for chart labels. */
export function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  if (!month || !day) return isoDate;
  return `${day} ${(MONTHS[month - 1] ?? '').slice(0, 3)}`;
}

/** 32.5 -> "32,5" (Turkish decimal comma). */
export function kg(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace('.', ',');
}

export function setsText(sets: number, repMin: number, repMax: number): string {
  return `${sets} × ${repMin === repMax ? repMin : `${repMin}-${repMax}`}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toLocaleUpperCase('tr-TR');
}

export const MEMBERSHIP_STATUS_TEXT: Record<MembershipStatus, string> = {
  active: 'Aktif',
  frozen: 'Dondurulmuş',
  expired: 'Süresi doldu',
  cancelled: 'İptal edildi',
};

export function formatPhone(phone: string): string {
  return phone.length === 10 ? `0${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 8)} ${phone.slice(8)}` : phone;
}
