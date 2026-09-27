// ============================================================================
// CONSTANTES Y HELPERS DE CALENDARIO Y HEATMAP (100% DATOS REALES)
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
  /** Se formatea en el cliente con el idioma activo; antes venía del servidor en español. */
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
