export interface StravaAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  city: string;
  country: string;
  profile: string;
  follower_count: number;
  friend_count: number;
  measurement_preference: 'feet' | 'meters';
  bikes: StravaGearSummary[];
  shoes: StravaGearSummary[];
}

export interface StravaGearSummary {
  id: string;
  name: string;
  primary: boolean;
  distance: number; // meters
  retired: boolean;
}

export interface StravaAthleteStats {
  recent_run_totals: StravaTotals;
  recent_ride_totals: StravaTotals;
  recent_swim_totals: StravaTotals;
  ytd_run_totals: StravaTotals;
  ytd_ride_totals: StravaTotals;
  ytd_swim_totals: StravaTotals;
  all_run_totals: StravaTotals;
  all_ride_totals: StravaTotals;
  all_swim_totals: StravaTotals;
}

export interface StravaTotals {
  count: number;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  elevation_gain: number; // meters
}

export interface StravaSummaryActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  average_speed: number; // m/s
  max_speed: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number;
  gear_id?: string;
  map?: { summary_polyline: string };
}

export interface StravaDetailedActivity extends StravaSummaryActivity {
  description?: string;
  calories?: number;
  device_name?: string;
  best_efforts?: StravaBestEffort[];
  segment_efforts?: StravaSegmentEffort[];
  splits_metric?: StravaSplit[];
  splits_standard?: StravaSplit[];
}

export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  moving_time: number;
  average_speed: number; // m/s
  average_heartrate?: number;
  pace_zone?: number;
  split: number;
}

export interface StravaBestEffort {
  name: string;
  elapsed_time: number;
  distance: number;
  start_date_local: string;
  pr_rank?: number;
}

export interface StravaSegmentEffort {
  name: string;
  elapsed_time: number;
  start_date_local: string;
  distance: number;
  average_heartrate?: number;
  kom_rank?: number;
  pr_rank?: number;
  segment: {
    id: number;
    name: string;
    distance: number;
    average_grade: number;
  };
}

export interface StravaAthleteZones {
  heart_rate?: {
    custom_zones: boolean;
    zones: StravaHRZone[];
  };
}

export interface StravaHRZone {
  min: number;
  max: number; // -1 means no upper limit
}

export interface StravaStarredSegment {
  id: number;
  name: string;
  distance: number; // meters
  average_grade: number;
  athlete_segment_stats?: {
    pr_elapsed_time?: number;
    pr_date?: string;
    effort_count: number;
    last_effort_elapsed_time?: number;
  };
  xoms?: {
    kom?: string;
    qom?: string;
    overall?: string;
  };
}

export interface StravaGear {
  id: string;
  name: string;
  brand_name?: string;
  model_name?: string;
  distance: number; // meters
  retired: boolean;
  resource_state: number;
}
