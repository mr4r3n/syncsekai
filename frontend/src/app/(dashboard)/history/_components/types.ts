// ============================================================================
// CALENDAR & HEATMAP CONSTANTS AND HELPERS (100% REAL DATA)
// ============================================================================
interface HeatmapDay {
  day: number;
  date: string;
  count: number;
  tier: number;
  isToday: boolean;
  isFuture: boolean;
  isPreHistory?: boolean;
}

interface MonthRecord {
  year: number;
  month: number;
  /** Formatted on client in active language; previously returned from server in Spanish. */
  label?: string;
  totalScrobbles: number;
  daysCount: number;
  firstActiveDay: number;
  isCurrent?: boolean;
  days: HeatmapDay[];
}

interface HeatmapResponse {
  months: MonthRecord[];
  totalScrobbles: number;
  currentStreak: number;
  bestStreak: number;
  earliestRecordDate: string;
  latestRecordDate: string;
}

export type { HeatmapDay, MonthRecord, HeatmapResponse };
