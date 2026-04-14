export type MeasurementPreference = 'feet' | 'meters';

export function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;

  start.setUTCDate(start.getUTCDate() + diff);
  start.setUTCHours(0, 0, 0, 0);

  return start;
}

export function weeksAgo(n: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - (n * 7));
  return date;
}

export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

export function formatDistance(
  meters: number,
  preference: MeasurementPreference,
): string {
  if (preference === 'feet') {
    return `${(meters / 1609.344).toFixed(2)} mi`;
  }

  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatPace(
  metersPerSecond: number,
  preference: MeasurementPreference,
): string {
  const unit = preference === 'feet' ? 'mi' : 'km';
  if (metersPerSecond <= 0) {
    return `-- /${unit}`;
  }

  const distance = preference === 'feet' ? 1609.344 : 1000;
  const totalSeconds = distance / metersPerSecond;
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = Math.round(totalSeconds % 60);

  if (seconds === 60) {
    minutes += 1;
    seconds = 0;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')} /${unit}`;
}
