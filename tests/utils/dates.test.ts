import { describe, expect, it } from 'vitest';
import {
  formatDistance,
  formatDuration,
  formatPace,
  startOfWeek,
  toUnixTimestamp,
} from '../../src/utils/dates.js';

describe('startOfWeek', () => {
  it('returns Monday 00:00:00 for a Wednesday', () => {
    const wed = new Date('2024-04-10T15:30:00Z');
    const result = startOfWeek(wed);

    expect(result.getUTCDay()).toBe(1);
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.toISOString()).toBe('2024-04-08T00:00:00.000Z');
  });

  it('returns the same Monday for a Monday', () => {
    const mon = new Date('2024-04-08T08:00:00Z');
    const result = startOfWeek(mon);

    expect(result.toISOString()).toBe('2024-04-08T00:00:00.000Z');
  });
});

describe('toUnixTimestamp', () => {
  it('converts Date to integer unix seconds', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    expect(toUnixTimestamp(date)).toBe(1704067200);
  });
});

describe('formatDuration', () => {
  it('formats seconds-only durations', () => {
    expect(formatDuration(45)).toBe('0m 45s');
  });

  it('formats minute durations', () => {
    expect(formatDuration(3661)).toBe('1h 1m');
  });

  it('formats sub-hour durations without hours', () => {
    expect(formatDuration(2700)).toBe('45m 0s');
  });
});

describe('formatDistance', () => {
  it('converts meters to km with 2 decimal places', () => {
    expect(formatDistance(10000, 'meters')).toBe('10.00 km');
  });

  it('converts meters to miles with 2 decimal places', () => {
    expect(formatDistance(10000, 'feet')).toBe('6.21 mi');
  });
});

describe('formatPace', () => {
  it('formats m/s as min/km for metric', () => {
    expect(formatPace(3.333, 'meters')).toBe('5:00 /km');
  });

  it('formats m/s as min/mile for imperial', () => {
    expect(formatPace(3.333, 'feet')).toBe('8:03 /mi');
  });

  it('returns -- for zero speed', () => {
    expect(formatPace(0, 'meters')).toBe('-- /km');
  });
});
