import { describe, expect, it } from 'vitest';
import {
  classifyHeartRate,
  defaultZones,
  intensityLabel,
} from '../../src/utils/zones.js';
import type { StravaHRZone } from '../../src/types.js';

const zones: StravaHRZone[] = [
  { min: 0, max: 115 },
  { min: 115, max: 152 },
  { min: 152, max: 171 },
  { min: 171, max: 190 },
  { min: 190, max: -1 },
];

describe('classifyHeartRate', () => {
  it('classifies Z1 as easy', () => {
    expect(classifyHeartRate(100, zones)).toBe('easy');
  });

  it('classifies Z2 as easy', () => {
    expect(classifyHeartRate(130, zones)).toBe('easy');
  });

  it('classifies Z3 as moderate', () => {
    expect(classifyHeartRate(160, zones)).toBe('moderate');
  });

  it('classifies Z4 as hard', () => {
    expect(classifyHeartRate(180, zones)).toBe('hard');
  });

  it('classifies Z5 (unbounded) as hard', () => {
    expect(classifyHeartRate(200, zones)).toBe('hard');
  });

  it('returns moderate when no zones provided', () => {
    expect(classifyHeartRate(150, [])).toBe('moderate');
  });
});

describe('defaultZones', () => {
  it('generates 5 zones based on max HR', () => {
    const generated = defaultZones(200);
    expect(generated).toHaveLength(5);
    expect(generated[0].min).toBe(0);
    expect(generated[4].max).toBe(-1);
  });
});

describe('intensityLabel', () => {
  it('formats distribution percentages', () => {
    expect(intensityLabel({ easy: 0.6, moderate: 0.3, hard: 0.1 }))
      .toBe('60% easy / 30% moderate / 10% hard');
  });
});
