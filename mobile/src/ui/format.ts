import type { MembershipStatus } from '../../../shared/contract';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** "2026-12-21" -> "21 Aralık 2026". Calendar dates carry no time zone, so no Date parsing. */
export function longDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return `${day} ${MONTHS[month - 1] ?? ''} ${year}`;
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
