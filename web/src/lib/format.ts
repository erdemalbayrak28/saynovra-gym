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
