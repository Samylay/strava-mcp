import type { StravaHRZone } from '../types.js';

export type IntensityBucket = 'easy' | 'moderate' | 'hard';

export interface IntensityDistribution {
  easy: number;
  moderate: number;
  hard: number;
}

export function classifyHeartRate(
  heartRate: number,
  zones: StravaHRZone[],
): IntensityBucket {
  if (zones.length === 0) {
    return 'moderate';
  }

  const zoneIndex = zones.findIndex(
    (zone) => heartRate >= zone.min && (zone.max === -1 || heartRate < zone.max),
  );

  if (zoneIndex === -1) {
    return 'moderate';
  }

  if (zoneIndex <= 1) {
    return 'easy';
  }

  if (zoneIndex === 2) {
    return 'moderate';
  }

  return 'hard';
}

export function defaultZones(maxHr = 190): StravaHRZone[] {
  return [
    { min: 0, max: Math.round(maxHr * 0.6) },
    { min: Math.round(maxHr * 0.6), max: Math.round(maxHr * 0.7) },
    { min: Math.round(maxHr * 0.7), max: Math.round(maxHr * 0.8) },
    { min: Math.round(maxHr * 0.8), max: Math.round(maxHr * 0.9) },
    { min: Math.round(maxHr * 0.9), max: -1 },
  ];
}

export function intensityLabel(dist: IntensityDistribution): string {
  const toPercent = (value: number): string => `${Math.round(value * 100)}%`;
  return `${toPercent(dist.easy)} easy / ${toPercent(dist.moderate)} moderate / ${toPercent(dist.hard)} hard`;
}

export function computeIntensityDistribution(
  heartRates: number[],
  zones: StravaHRZone[],
): IntensityDistribution {
  if (heartRates.length === 0) {
    return { easy: 0, moderate: 0, hard: 0 };
  }

  let easy = 0;
  let moderate = 0;
  let hard = 0;

  for (const heartRate of heartRates) {
    const bucket = classifyHeartRate(heartRate, zones);

    if (bucket === 'easy') {
      easy += 1;
    } else if (bucket === 'moderate') {
      moderate += 1;
    } else {
      hard += 1;
    }
  }

  const total = heartRates.length;
  return {
    easy: easy / total,
    moderate: moderate / total,
    hard: hard / total,
  };
}
