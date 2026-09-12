'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, getApiBase } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { ListRow, ListRows } from '@/components/ListRow';
import { SyncStatus, SyncSummary, type TrackersVinculados } from '@/components/SyncStatus';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  History,
  Clock,
  Folder,
  RefreshCw,
  Film,
  CheckSquare,
  Square,
  MinusSquare,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
  Rows2,
  Rows3,
  Rows4,
  Layers,
  MoreVertical,
  ExternalLink,
  Copy,
  RotateCcw,
  Link2,
  Calendar,
  Sparkles,
  Lock,
  Flame,
  Zap,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { BottomSheet } from '@/components/BottomSheet';

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

function getMonthStartDayOffset(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7; // Monday = 0, ..., Sunday = 6
}

/** "September 2026" o "septiembre de 2026" según el idioma activo. */
function etiquetaMes(year: number, month: number, locale: string) {
  return new Date(year, month, 1).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB', { month: 'long', year: 'numeric' });
}

function formatDateReadable(isoDate: string) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

interface DatePickerProps {
  currentDate: string;
  minDate: string;
  maxDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  title: string;
  isLightMode: boolean;
  availableMonths?: MonthRecord[];
}

function DatePickerPopover({
  currentDate,
  minDate,
  maxDate,
  onSelect,
  onClose,
  title,
  isLightMode,
  availableMonths = [],
}: DatePickerProps) {
  const { t, locale } = useI18n();
  const [currY, currM] = currentDate ? currentDate.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const monthsList = availableMonths && availableMonths.length > 0
    ? availableMonths
    : [{ year: currY, month: currM - 1, totalScrobbles: 0, daysCount: 30, firstActiveDay: 1, days: [] }];

  const [pickerMonthIndex, setPickerMonthIndex] = useState(() => {
    const idx = monthsList.findIndex((m) => m.year === currY && m.month === currM - 1);
    return idx >= 0 ? idx : Math.max(0, monthsList.length - 1);
  });

  const monthInfo = monthsList[pickerMonthIndex] || monthsList[0];
  const paddingSlots = getMonthStartDayOffset(monthInfo.year, monthInfo.month);
  const canGoPrev = pickerMonthIndex > 0;
  const canGoNext = pickerMonthIndex < monthsList.length - 1;

  const handleDayClick = (day: number) => {
    const mStr = String(monthInfo.month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateStr = `${monthInfo.year}-${mStr}-${dStr}`;
    onSelect(dateStr);
    onClose();
  };

  return (
    <div
      className={`absolute top-full left-0 mt-2 z-50 w-68 sm:w-72 p-3.5 rounded-[8px] border shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 space-y-3 text-left ${
        isLightMode
          ? 'bg-white border-zinc-200 text-zinc-900 shadow-zinc-400/30'
          : 'bg-[#222225] border-zinc-700 text-zinc-100 shadow-black/70'
      }`}
    >
      {/* Cabecera con selector de mes */}
      <div
        className={`flex items-center justify-between border-b pb-2 ${
          isLightMode ? 'border-zinc-200' : 'border-zinc-700'
        }`}
      >
        <button
          type="button"
          onClick={() => setPickerMonthIndex((prev) => Math.max(0, prev - 1))}
          disabled={!canGoPrev}
          className={`w-7 h-7 rounded-[4px] border flex items-center justify-center transition-all cursor-pointer ${
            isLightMode
              ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900'
              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-white'
          } disabled:opacity-20 disabled:cursor-not-allowed`}
          title={canGoPrev ? t('history.previousMonth') : 'Primer mes alcanzado'}
        >
          <ChevronLeft className={`w-4 h-4 shrink-0 ${isLightMode ? 'text-zinc-900' : 'text-white'}`} />
        </button>

        <span
          className={`text-xs font-bold font-heading ${
            isLightMode ? 'text-zinc-900' : 'text-white'
          }`}
        >
          {etiquetaMes(monthInfo.year, monthInfo.month, locale)}
        </span>

        <button
          type="button"
          onClick={() =>
            setPickerMonthIndex((prev) => Math.min(monthsList.length - 1, prev + 1))
          }
          disabled={!canGoNext}
          className={`w-7 h-7 rounded-[4px] border flex items-center justify-center transition-all cursor-pointer ${
            isLightMode
              ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900'
              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-white'
          } disabled:opacity-20 disabled:cursor-not-allowed`}
          title={canGoNext ? t('history.nextMonth') : t('history.currentMonthNoFuture')}
        >
          <ChevronRight className={`w-4 h-4 shrink-0 ${isLightMode ? 'text-zinc-900' : 'text-white'}`} />
        </button>
      </div>

      {/* Cabeceras de días de semana */}
      <div
        className={`grid grid-cols-7 text-center text-[10px] font-mono font-bold ${
          isLightMode ? 'text-zinc-600' : 'text-zinc-400'
        }`}
      >
        <span>LU</span>
        <span>MA</span>
        <span>MI</span>
        <span>JU</span>
        <span>VI</span>
        <span>SA</span>
        <span>DO</span>
      </div>

      {/* Rejilla de días */}
      <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
        {Array.from({ length: paddingSlots }).map((_, idx) => (
          <div key={`pad-${idx}`} className="h-7" />
        ))}

        {Array.from({ length: monthInfo.daysCount }).map((_, idx) => {
          const day = idx + 1;
          const mStr = String(monthInfo.month + 1).padStart(2, '0');
          const dStr = String(day).padStart(2, '0');
          const dateStr = `${monthInfo.year}-${mStr}-${dStr}`;

          const isBeforeMin = dateStr < minDate;
          const isAfterMax = dateStr > maxDate;
          const isDisabled = isBeforeMin || isAfterMax;
          const isSelected = dateStr === currentDate;

          let dayStyle = '';
          if (isSelected) {
            dayStyle = 'bg-[#FF634A] text-white font-bold shadow-xs';
          } else if (isDisabled) {
            dayStyle = `opacity-25 cursor-not-allowed border border-dashed ${
              isLightMode ? 'border-zinc-300 text-zinc-400' : 'border-zinc-700 text-zinc-500'
            }`;
          } else {
            dayStyle = isLightMode
              ? 'text-zinc-900 hover:bg-zinc-100 font-semibold'
              : 'text-zinc-100 hover:bg-zinc-800 font-medium';
          }

          return (
            <button
              key={day}
              type="button"
              disabled={isDisabled}
              onClick={() => handleDayClick(day)}
              className={`h-7 w-7 mx-auto rounded-[4px] flex items-center justify-center transition-all cursor-pointer ${dayStyle}`}
              title={
                isBeforeMin
                  ? 'Fecha bloqueada: Sin registros de historial (mín: 15/01/2026)'
                  : isAfterMax
                  ? 'Fecha futura'
                  : dateStr
              }
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Pie con advertencia de bloqueo y botón de cerrar */}
      <div
        className={`flex items-center justify-between pt-2 border-t text-[10.5px] font-mono ${
          isLightMode ? 'border-zinc-200' : 'border-zinc-700'
        }`}
      >
        <span
          className={`flex items-center gap-1 ${
            isLightMode ? 'text-zinc-600' : 'text-zinc-400'
          }`}
        >
          <Lock className={`w-3 h-3 ${isLightMode ? 'text-amber-700' : 'text-amber-400'}`} />
          <span>Límite: {formatDateReadable(minDate)} - {formatDateReadable(maxDate)}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className={`text-xs px-2 py-0.5 rounded-[4px] border font-semibold cursor-pointer transition-colors ${
            isLightMode
              ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900'
              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-white'
          }`}
        >{t('common.close')}</button>
      </div>
    </div>
  );
}

function getHeatmapTierClass(tier: number, isLight: boolean) {
  if (tier === 0) {
    return isLight
      ? 'bg-zinc-100 border-zinc-200 text-zinc-700 font-semibold'
      : 'bg-[var(--bg-surface-elevated)]/40 border-[var(--border-subtle)] text-[var(--text-muted)]';
  }
  if (tier === 1) {
    return isLight
      ? 'bg-amber-100 border-amber-300 text-zinc-950 font-bold shadow-xs'
      : 'bg-amber-500/20 border-amber-500/35 text-amber-300 font-semibold';
  }
  if (tier === 2) {
    return isLight
      ? 'bg-amber-200 border-amber-400 text-zinc-950 font-bold shadow-xs'
      : 'bg-amber-500/45 border-amber-500/60 text-amber-100 font-bold';
  }
  if (tier === 3) {
    return isLight
      ? 'bg-orange-500 border-orange-600 text-white font-bold shadow-xs'
      : 'bg-orange-500/80 border-orange-500/90 text-white font-bold shadow-xs';
  }
  return isLight
    ? 'bg-orange-600 border-orange-700 text-white font-black shadow-sm'
    : 'bg-orange-500 border-orange-300 text-white font-bold shadow-sm';
}

/**
 * Texto de estado de cada tracker, ya traducido.
 *
 * Vive aqui y no dentro de SyncStatus porque ese componente no debe conocer el
 * sistema de traduccion: recibe cadenas, no claves.
 */
function etiquetasSync(item: any, t: (k: string, v?: any) => string) {
  const texto = (estado: string, tracker: string) =>
    estado === 'SUCCESS'
      ? t('history.syncedOn', { tracker })
      : estado === 'FAILED'
      ? t('history.syncFailedOn', { tracker })
      : t('history.notConfiguredOn', { tracker });

  return {
    anilist: texto(item.anilistStatus, 'AniList'),
    mal: texto(item.malStatus, 'MyAnimeList'),
    kitsu: texto(item.kitsuStatus, 'Kitsu'),
  };
}

function TrackerButton({
  provider,
  active,
  title,
}: {
  provider: 'anilist' | 'mal' | 'kitsu';
  active: boolean;
  title: string;
}) {
  let activeStyles = '';
  if (provider === 'anilist') {
    activeStyles = 'border-[#02A9FF]/40 bg-[#02A9FF]/12 text-[#02A9FF] shadow-xs';
  } else if (provider === 'mal') {
    activeStyles = 'border-[#2E51A2]/40 bg-[#2E51A2]/15 text-[#2E51A2] shadow-xs';
  } else {
    activeStyles = 'border-[#FD755C]/40 bg-[#FD755C]/15 text-[#FD755C] shadow-xs';
  }

  const inactiveStyles =
    'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-35 hover:opacity-60';

  return (
    <div
      title={title}
      className={`w-8 h-8 rounded-[6px] border flex items-center justify-center transition-all shrink-0 cursor-default select-none ${
        active ? activeStyles : inactiveStyles
      }`}
    >
      {provider === 'anilist' && (
        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor">
          <path d="M24 17.53v2.421c0 .71-.391 1.101-1.1 1.101h-5l-.057-.165L11.84 3.736c.106-.502.46-.788 1.053-.788h2.422c.71 0 1.1.391 1.1 1.1v12.38H22.9c.71 0 1.1.392 1.1 1.101zM11.034 2.947l6.337 18.104h-4.918l-1.052-3.131H6.019l-1.077 3.131H0L6.361 2.948h4.673zm-.66 10.96-1.69-5.014-1.541 5.015h3.23z" />
        </svg>
      )}
      {provider === 'mal' && (
        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor">
          <path d="M14.921 6.479c-.82 0-3.683 0-4.947 3.156-.662 1.652-.986 4.812.876 7.886l1.934-1.41s-.767-1.095-1.083-3.191h2.897l.022 3.19h2.604V8.835h-2.581v2.043l-2.46-.023s.413-2.408 2.877-2.336h2.454l-.572-2.04ZM0 6.528v9.624h2.348v-5.84l2.031 2.664 2.047-2.652v5.828h2.336V6.528H6.437L4.368 9.474 2.31 6.528Zm18.447.022v9.583h5.022L24 14.09h-3.232V6.55Z" />
        </svg>
      )}
      {provider === 'kitsu' && (
        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor">
          <path d="M1.429 5.441a12.478 12.478 0 0 0 1.916 2.056c.011.011.022.011.022.022c.452.387 1.313.947 1.937 1.173 0 0 3.886 1.496 4.091 1.582a1.4 1.4 0 0 0 .237.075.694.694 0 0 0 .808-.549c.011-.065.022-.172.022-.248V5.161c.011-.667-.205-1.679-.398-2.239 0-.011-.011-.022-.011-.032A11.979 11.979 0 0 0 8.824.36L8.781.285a.697.697 0 0 0-.958-.162c-.054.032-.086.075-.129.119L7.608.36a4.743 4.743 0 0 0-.786 3.412 8.212 8.212 0 0 0-.775.463c-.043.032-.42.291-.71.56A4.803 4.803 0 0 0 1.87 4.3c-.043.011-.097.021-.14.032-.054.022-.107.043-.151.076a.702.702 0 0 0-.193.958l.043.075zM8.222 1.07c.366.614.678 1.249.925 1.917-.495.086-.98.215-1.453.388a3.918 3.918 0 0 1 .528-2.305zM4.658 5.463a7.467 7.467 0 0 0-.893 1.216 11.68 11.68 0 0 1-1.453-1.55 3.825 3.825 0 0 1 2.346.334zm13.048-.302a7.673 7.673 0 0 0-2.347-.474 7.583 7.583 0 0 0-3.811.818l-.215.108v3.918c0 .054 0 .258-.032.431a1.535 1.535 0 0 1-.646.98 1.545 1.545 0 0 1-1.152.247 2.618 2.618 0 0 1-.409-.118 747.6 747.6 0 0 1-3.402-1.313 8.9 8.9 0 0 0-.323-.129 30.597 30.597 0 0 0-3.822 3.832l-.075.086a.698.698 0 0 0 .538 1.098.676.676 0 0 0 .42-.118c.011-.011.022-.022.043-.032 1.313-.947 2.756-1.712 4.284-2.325a.7.7 0 0 1 .818.13.704.704 0 0 1 .054.915l-.237.388a20.277 20.277 0 0 0-1.97 4.306l-.032.129a.646.646 0 0 0 .108.538.713.713 0 0 0 .549.301.657.657 0 0 0 .42-.118c.054-.043.108-.086.151-.14l.043-.065a18.95 18.95 0 0 1 1.765-2.153 20.156 20.156 0 0 1 10.797-6.018c.032-.011.065-.011.097-.011.237.011.42.215.409.452a.424.424 0 0 1-.344.398c-3.908.829-10.948 5.469-8.483 12.208.043.108.075.172.129.269a.71.71 0 0 0 .538.301.742.742 0 0 0 .657-.398c.398-.754 1.152-1.593 3.326-2.497 6.061-2.508 7.062-6.093 7.17-8.364v-.129a7.716 7.716 0 0 0-5.016-7.451zm-6.083 17.762c-.56-1.669-.506-3.283.151-4.823 1.26 2.035 3.456 2.207 3.456 2.207-2.25.937-3.133 1.863-3.607 2.616z" />
        </svg>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast, showUndoToast } = useToast();
  const { t, locale } = useI18n();

  // Detección reactiva de Modo Claro / Modo Oscuro
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const themeAttr = document.documentElement.getAttribute('data-theme');
      setIsLightMode(themeAttr === 'light');
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    window.addEventListener('plexsync_theme_changed', checkTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener('plexsync_theme_changed', checkTheme);
    };
  }, []);

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtro de Estado: Todo, Éxitos, Errores
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR'>('ALL');

  // Modal de Confirmación Glassmorphism
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Estados de Paginación & Búsqueda
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [total, setTotal] = useState(0);
  /*
   * Las cifras de las tarjetas de arriba, contadas en la base.
   */
  const [resumen, setResumen] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [jumpPage, setJumpPage] = useState('');

  // Estados para selección por lotes (Batch Selection)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [activeHistorySheetItem, setActiveHistorySheetItem] = useState<any | null>(null);

  // Que trackers tiene vinculados. Es un dato de la cuenta, no del scrobble:
  // sin el, "no lo tienes puesto" y "lo tienes y fallo" se ven igual, y el
  // contador dice 1/3 cuando lo correcto es 1/1.
  const [vinculados, setVinculados] = useState<TrackersVinculados>({
    anilist: true,
    mal: true,
    kitsu: true,
  });

  useEffect(() => {
    api.auth
      .me()
      .then((res) => {
        const conexiones = (res?.user || res)?.animeConnections || [];
        const puesto = (p: string) =>
          conexiones.some((c: any) => c.provider === p && c.isConnected);
        setVinculados({
          anilist: puesto('ANILIST'),
          mal: puesto('MAL'),
          kitsu: puesto('KITSU'),
        });
      })
      // Si falla, se asume que estan los tres: es mejor mostrar de mas que
      // esconder un fallo real de sincronizacion.
      .catch(() => {});
  }, []);

  // Estados de Ritmo Temporal y Filtro de Fechas (100% Reales)
  const [heatmapData, setHeatmapData] = useState<HeatmapResponse | null>(null);
  const [dateFilterMode, setDateFilterMode] = useState<'month' | 'range'>('month');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateWarning, setDateWarning] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null);
  const [activePreset, setActivePreset] = useState<'month' | 'last30' | 'all' | 'custom'>('month');
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);

  const loadHeatmap = useCallback(async () => {
    try {
      const res = await api.history.getHeatmap();
      if (res && Array.isArray(res.months) && res.months.length > 0) {
        setHeatmapData(res);
        setSelectedMonthIndex(res.months.length - 1);
        setStartDate(res.earliestRecordDate);
        setEndDate(res.latestRecordDate);
      }
    } catch (e: any) {
      console.warn('Error cargando heatmap real:', e.message);
    }
  }, []);


  useEffect(() => {
    api.history
      .getSummary()
      .then(setResumen)
      .catch(() => setResumen(null));
  }, []);

  useEffect(() => {
    loadHeatmap();
  }, [loadHeatmap]);

  // Cerrar picker de fecha al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dark-datepicker-container')) {
        setOpenPicker(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cargar estado inicial de paginación desde URL o localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlPage = params.get('page');
    if (urlPage) {
      const p = parseInt(urlPage, 10);
      if (!isNaN(p) && p > 0) setPage(p);
    } else {
      const savedPage = localStorage.getItem('plexsync_history_page');
      if (savedPage) {
        const p = parseInt(savedPage, 10);
        if (!isNaN(p) && p > 0) setPage(p);
      }
    }
  }, []);

  const changePage = (newPage: number) => {
    setPage(newPage);
    if (typeof window !== 'undefined') {
      localStorage.setItem('plexsync_history_page', String(newPage));
      const url = new URL(window.location.href);
      url.searchParams.set('page', String(newPage));
      window.history.replaceState({}, '', url.toString());
    }
  };

  const loadHistory = useCallback(async (targetPage = page, targetLimit = limit, targetSearch = search) => {
    try {
      setLoading(true);
      const res = await api.history.get({
        page: targetPage,
        limit: targetLimit,
        search: targetSearch,
      });

      if (Array.isArray(res)) {
        setHistory(res);
        setTotal(res.length);
        setTotalPages(1);
      } else if (res && typeof res === 'object') {
        setHistory(res.items || []);
        setTotal(res.total || 0);
        setPage(res.page || targetPage);
        setTotalPages(res.totalPages || 1);
        setLimit(res.limit || targetLimit);
      }
      setSelectedIds([]);
    } catch (e: any) {
      showToast(`${t('history.loadHistoryError')} ` + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, showToast]);

  useEffect(() => {
    loadHistory(page, limit, search);
  }, [page, limit, search, loadHistory]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadHistory(page, limit, search), loadHeatmap()]);
    setIsRefreshing(false);
    showToast('Historial actualizado.', 'success');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPage, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setPage(p);
      setJumpPage('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Manejo de Selección de Checkboxes
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === history.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(history.map((h) => h.id));
    }
  };

  // Reversión individual
  const handleDeleteAndRevert = (item: any) => {
    setConfirmModal({
      isOpen: true,
      title: t('history.confirmRevertScrobble'),
      description: t('history.revertOneDesc', { title: `${item.showTitle} Ep. ${item.episodeNumber}` }),
      confirmText: t('history.revertScrobble'),
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setHistory((prev) => prev.filter((h) => h.id !== item.id));
        setTotal((prev) => Math.max(0, prev - 1));
        showUndoToast(t('common.deletingItem', { name: `${item.showTitle} Ep. ${item.episodeNumber}` }), {
          alDeshacer: () => loadHistory(page, limit, search),
          alExpirar: async () => {
            try {
              await api.history.deleteAndRevert(item.id);
              showToast(t('history.scrobbleReverted'), 'success');
            } catch (e: any) {
              showToast(e.message || t('history.revertError'), 'error');
            }
            loadHistory(page, limit, search);
          },
        });
      },
    });
  };

  // Reversión por Lotes
  const handleBatchDeleteAndRevert = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;

    setConfirmModal({
      isOpen: true,
      title: t('history.revertSelectedTitle', { n: count }),
      description: t('history.revertBatchDesc'),
      confirmText: t('history.revertSelected', { n: count }),
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const idsToProcess = [...selectedIds];
        setHistory((prev) => prev.filter((h) => !idsToProcess.includes(h.id)));
        setSelectedIds([]);
        showUndoToast(t('history.revertingN', { n: count }), {
          alDeshacer: () => loadHistory(page, limit, search),
          alExpirar: () => revertirEnLote(idsToProcess),
        });
      },
    });
  };

  // Peticiones escalonadas para respetar los limites de AniList / MAL.
  const revertirEnLote = async (idsToProcess: string[]) => {
        const count = idsToProcess.length;
        setIsBatchProcessing(true);
        setBatchProgress({ current: 0, total: count });
        let successfulCount = 0;

        for (let i = 0; i < idsToProcess.length; i++) {
          const id = idsToProcess[i];
          setBatchProgress({ current: i + 1, total: count });

          try {
            await api.history.deleteAndRevert(id);
            successfulCount++;
            setHistory((prev) => prev.filter((h) => h.id !== id));
          } catch (err: any) {
            console.warn(`Error al revertir ID ${id}:`, err.message);
          }

          if (i < idsToProcess.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 600));
          }
        }

        setIsBatchProcessing(false);
        setBatchProgress(null);
        showToast(t('history.batchDone', { ok: successfulCount, total: count }), 'success');
        loadHistory(page, limit, search);
  };

  const isAllSelected = history.length > 0 && selectedIds.length === history.length;
  const isPartiallySelected = selectedIds.length > 0 && selectedIds.length < history.length;

  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  // Helper para construir la URL absoluta de portada si es relativa (/api/covers/...)
  const resolveCoverUrl = (cover: string | null) => {
    if (!cover) return null;
    if (cover.startsWith('http://') || cover.startsWith('https://')) return cover;
    return `${getApiBase()}${cover}`;
  };

  // Filtrar elementos según statusFilter
  const filteredHistory = useMemo(() => {
    if (statusFilter === 'SUCCESS') {
      return history.filter(
        (item) =>
          item.anilistStatus === 'SUCCESS' ||
          item.malStatus === 'SUCCESS' ||
          item.kitsuStatus === 'SUCCESS',
      );
    }
    if (statusFilter === 'ERROR') {
      return history.filter(
        (item) =>
          item.anilistStatus === 'FAILED' ||
          item.malStatus === 'FAILED' ||
          item.anilistStatus === 'SKIPPED',
      );
    }
    return history;
  }, [history, statusFilter]);

  const monthsList = heatmapData?.months || [];
  const currentMonthData = monthsList[selectedMonthIndex] || monthsList[monthsList.length - 1];
  const earliestDate = heatmapData?.earliestRecordDate || '2026-01-01';
  const latestDate = heatmapData?.latestRecordDate || new Date().toISOString().slice(0, 10);

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          rootLabel={t('navigation.userLibrary')}
          currentLabel={t('history.title')}
          onRefresh={handleRefresh}
          isRefreshing={loading || isRefreshing}
        />

        <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-6 min-w-0">
          {/* BARRA DE SELECCION MULTIPLE
              Anclada abajo y fuera del flujo, para no desplazar la lista al
              aparecer. Ademas asi sigue
              visible mientras marcas mas, y en el movil cae donde llega el
              pulgar. */}
          {selectedIds.length > 0 && (
            <div
              role="region"
              aria-label={t('history.selectionBar')}
              className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-2xl p-3 rounded-[var(--radius-lg)] border border-[var(--status-danger)]/30 bg-[var(--bg-surface-elevated)]/95 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[var(--glass-shadow-lg)] animate-in fade-in slide-in-from-bottom-4 duration-200"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-bold text-[var(--status-danger)]">
                  {t('history.selectedCount', { n: selectedIds.length })}
                </span>
                {batchProgress && (
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    {t('history.batchProgress', {
                      current: batchProgress.current,
                      total: batchProgress.total,
                    })}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setSelectedIds([])}
                  disabled={isBatchProcessing}
                  className="btn-secondary text-xs"
                >
                  {t('history.cancelSelection')}
                </button>
                <button
                  onClick={handleBatchDeleteAndRevert}
                  disabled={isBatchProcessing}
                  className="btn-danger text-xs"
                >
                  {isBatchProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('history.reverting')}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('history.revertSelected')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* CABECERA CON BÚSQUEDA Y CONTROLES (ANCHO COMPLETO) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
                {t('history.title')}
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('history.subtitle')}
              </p>
            </div>

            {/* BÚSQUEDA Y CONTROLES */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap w-full sm:w-auto">
              <form
                onSubmit={handleSearchSubmit}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-[var(--radius-md,6px)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md text-xs flex-1 sm:flex-initial focus-within:border-[var(--border-focus)] focus-within:ring-1 focus-within:ring-[var(--border-focus)] transition-all"
              >
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                <input
                  type="text"
                  placeholder={t('history.searchPlaceholder')}
                  autoComplete="off"
                  suppressHydrationWarning
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="bg-transparent outline-none text-xs w-full sm:w-56 text-[var(--text-primary)]"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* Selector de Elementos por Página */}
              <div className="w-28 sm:w-32 shrink-0">
                <CustomSelect
                  value={String(limit)}
                  onChange={(val) => handleLimitChange(Number(val))}
                  options={[
                    { value: '15', label: t('history.perPage', { n: 15 }), icon: <Rows2 className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" /> },
                    { value: '30', label: t('history.perPage', { n: 30 }), icon: <Rows3 className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" /> },
                    { value: '50', label: t('history.perPage', { n: 50 }), icon: <Rows4 className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" /> },
                    { value: '100', label: t('mappings.hundredPerPage'), icon: <Layers className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" /> },
                  ]}
                  accentColor="cinnabar"
                />
              </div>

              <button
                onClick={handleRefresh}
                disabled={loading || isBatchProcessing}
                className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
                title={t('history.refreshHistory')}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[var(--color-brand-primary,#FF634A)] ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{t('history.refresh')}</span>
              </button>
            </div>
          </div>

          {/* 4 TARJETAS KPI SUPERIORES */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* KPI 1: SCROBBLES */}
            <div className="glass-card p-4 sm:p-5 flex flex-col justify-between min-h-[110px] relative">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Scrobbles
                </span>
                <div className="w-7 h-7 rounded-[6px] bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border border-[var(--accent-primary)]/20 flex items-center justify-center">
                  <History className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[var(--text-primary)] my-1">
                {total}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                {typeof resumen?.variacionMensual === 'number' ? (
                  <>
                    <span
                      className={`font-semibold flex items-center gap-0.5 ${
                        resumen.variacionMensual >= 0 ? 'text-emerald-400' : 'text-[var(--status-danger)]'
                      }`}
                    >
                      <TrendingUp
                        className={`w-3 h-3 ${resumen.variacionMensual < 0 ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                      {resumen.variacionMensual >= 0 ? '+' : ''}
                      {resumen.variacionMensual}%
                    </span>
                    <span className="text-[var(--text-muted)]">{t('history.vsLastMonth')}</span>
                  </>
                ) : (
                  <span className="text-[var(--text-muted)]">
                    {resumen ? t('history.firstMonth') : t('history.noData')}
                  </span>
                )}
              </div>
            </div>

            {/* KPI 2: EPISODIOS */}
            <div className="glass-card p-4 sm:p-5 flex flex-col justify-between min-h-[110px] relative">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('history.episodes')}
                </span>
                <div className="w-7 h-7 rounded-[6px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <Film className="w-3.5 h-3.5" />
                </div>
              </div>
              {/* Episodios distintos, contados. La duracion real no se guarda,
                  asi que no hay "tiempo visto". */}
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[var(--text-primary)] my-1">
                {typeof resumen?.episodios === 'number' ? resumen.episodios : t('history.noData')}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className="text-[var(--text-muted)]">{t('history.episodesDistinct')}</span>
              </div>
            </div>

            {/* KPI 3: PRECISIÓN */}
            <div className="glass-card p-4 sm:p-5 flex flex-col justify-between min-h-[110px] relative">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('history.accuracy')}</span>
                <div className="w-7 h-7 rounded-[6px] bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-emerald-400 my-1">
                {typeof resumen?.tasaExito === 'number' ? `${resumen.tasaExito}%` : t('history.noData')}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className="text-emerald-400 font-semibold">{resumen?.correctos ?? 0}</span>
                <span className="text-[var(--text-muted)]">{t('history.syncedOk')}</span>
              </div>
            </div>

            {/* La cuarta tarjeta era "Latencia media: 164 ms", un numero fijo.
                No hay nada que mida el tiempo de cada envio -no se guarda-, asi
                que la tarjeta desaparece en vez de seguir inventandolo. Las
                otras tres se reparten el ancho. */}
          </div>

          {/* GRID PRINCIPAL: 8 COLS SCROBBLES / 4 COLS RITMO DE VISUALIZACIÓN */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* COLUMNA IZQUIERDA: ACTIVIDAD RECIENTE (8 COLS) */}
            <div className="xl:col-span-8 space-y-4 min-w-0">
              {/* TARJETA DE CONTENEDOR DE SCROBBLES */}
              <div className="glass-card -mx-4 sm:mx-0 rounded-none sm:rounded-[10px] border-x-0 sm:border-x px-0 py-4 sm:p-5 space-y-4">
                {/* BARRA SUPERIOR: SELECCIÓN + TÍTULO ACTIVIDAD RECIENTE + FILTROS DE ESTADO */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 px-3 sm:px-0 border-b border-[var(--glass-border)]">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSelectAll}
                      disabled={history.length === 0 || isBatchProcessing}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus:outline-none cursor-pointer"
                      title={isAllSelected ? t('history.deselectAllOnPage') : t('history.selectAllOnPage')}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                      ) : isPartiallySelected ? (
                        <MinusSquare className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-amber-400" />
                      <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('history.recentActivity')}</h2>
                    </div>

                    <span className="text-xs font-mono text-[var(--text-muted)] hidden md:inline">
                      ({t('history.showing')} <strong className="text-[var(--text-primary)]">{startRecord} - {endRecord}</strong> {t('history.of')} <strong className="text-[var(--text-primary)]">{total}</strong>)
                    </span>
                  </div>

                  {/* FILTRO DE ESTADO: TODO / ÉXITOS / ERRORES */}
                  <div className="flex items-center gap-1 p-1 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-mono self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === 'ALL'
                          ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold shadow-xs'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >{t('history.allFilter')}</button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('SUCCESS')}
                      className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === 'SUCCESS'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >{t('history.successes')}</button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('ERROR')}
                      className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === 'ERROR'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-xs'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {t('history.errorsTab')}
                    </button>
                  </div>
                </div>

                {/* LISTA DE ELEMENTOS */}
                <div>
                  {loading ? (
                    <div className="space-y-3 py-3 animate-in fade-in">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="py-2 px-2.5 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-transparent"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="skeleton w-4 h-4 rounded shrink-0" />
                            <div className="skeleton w-9 h-12 rounded-[var(--radius-sm)] shrink-0" />
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="skeleton h-3.5 w-1/3 rounded" />
                              <div className="skeleton h-2.5 w-1/4 rounded" />
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="skeleton h-7 w-20 rounded-[var(--radius-sm)]" />
                            <div className="skeleton h-8 w-8 rounded-[var(--radius-sm)]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredHistory.length === 0 ? (
                    <div className="py-16 px-3 text-center text-xs font-mono text-[var(--text-muted)] space-y-2">
                      <p>{t('history.noViewingEvents')}</p>
                      {search && (
                        <button
                          onClick={handleClearSearch}
                          className="text-sky-400 hover:underline inline-block mt-1"
                        >{t('catalog.clearSearch')}</button>
                      )}
                    </div>
                  ) : (
                    <ListRows label={t('history.recentActivity')}>
                    {filteredHistory.map((item) => {
                      const isSelected = selectedIds.includes(item.id);
                      const formattedDate =
                        typeof item.viewedAt === 'string'
                          ? new Date(item.viewedAt).toLocaleString([], {
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : item.viewedAt;

                      // S02E15: dos digitos siempre, para que la columna no
                      // baile entre el episodio 9 y el 10.
                      const dosDigitos = (n: number) => String(n).padStart(2, '0');
                      const codigoEpisodio = `S${dosDigitos(item.seasonNumber || 1)}E${dosDigitos(
                        item.episodeNumber || 0,
                      )}`;

                      const fechaCorta =
                        typeof item.viewedAt === 'string'
                          ? new Date(item.viewedAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })
                          : item.viewedAt;

                      const resolvedCover = resolveCoverUrl(item.coverImage);
                      const fallo =
                        item.anilistStatus === 'FAILED' || item.malStatus === 'FAILED';
                      const sinMapear =
                        !item.isMapped &&
                        !item.anilistMediaId &&
                        (item.anilistStatus === 'SKIPPED' ||
                          item.anilistStatus === 'FAILED' ||
                          item.malStatus === 'FAILED');

                      return (
                        <ListRow
                          key={item.id}
                          selected={isSelected}
                          onSelect={() => handleToggleSelect(item.id)}
                          selectDisabled={isBatchProcessing}
                          tone={fallo ? 'danger' : 'default'}
                          onOpen={() => setActiveHistorySheetItem(item)}
                          openLabel={t('history.openScrobbleOptions')}
                          media={
                            resolvedCover ? (
                              <img
                                src={resolvedCover}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = item.anilistMediaId
                                    ? `https://img.anili.st/media/${item.anilistMediaId}`
                                    : 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg';
                                }}
                                className="w-9 h-12 rounded-[var(--radius-sm)] object-cover border border-[var(--border-subtle)] bg-[var(--bg-app)]"
                              />
                            ) : (
                              <div className="w-9 h-12 rounded-[var(--radius-sm)] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)]">
                                <Film className="w-4 h-4" aria-hidden="true" />
                              </div>
                            )
                          }
                          title={item.showTitle}
                          // El orden manda: en movil sobreviven los dos
                          // primeros. De los tres datos que situan un scrobble
                          // -que anime, que episodio y cuando- el primero va
                          // en el titulo y los otros dos abren esta linea.
                          meta={[
                            codigoEpisodio,
                            // Corta en movil, con hora en escritorio.
                            <>
                              <span className="md:hidden">{fechaCorta}</span>
                              <span className="hidden md:inline">{formattedDate}</span>
                            </>,
                            item.librarySectionTitle || t('history.libraryUnknown'),
                            `${Math.round(item.viewPercentage || 95)}% ${t('history.watchedSuffix')}`,
                            item.rating ? `★ ${item.rating}/10` : null,
                            item.episodeTitle || null,
                          ]}
                          status={
                            <>
                              {/* En movil una sola pieza: el detalle por
                                  tracker esta a un toque, en la hoja. */}
                              <SyncSummary
                                className="md:hidden"
                                vinculados={vinculados}
                                anilist={item.anilistStatus}
                                mal={item.malStatus}
                                kitsu={item.kitsuStatus}
                                resumen={
                                  fallo
                                    ? t('history.syncSummaryFailed')
                                    : t('history.syncSummary', {
                                        ok: [
                                          vinculados.anilist && item.anilistStatus === 'SUCCESS',
                                          vinculados.mal && item.malStatus === 'SUCCESS',
                                          vinculados.kitsu && item.kitsuStatus === 'SUCCESS',
                                        ].filter(Boolean).length,
                                        total: [vinculados.anilist, vinculados.mal, vinculados.kitsu].filter(
                                          Boolean,
                                        ).length,
                                      })
                                }
                              />
                              <SyncStatus
                                className="hidden md:flex"
                                vinculados={vinculados}
                                anilist={item.anilistStatus}
                                mal={item.malStatus}
                                kitsu={item.kitsuStatus}
                                etiquetas={etiquetasSync(item, t)}
                              />
                            </>
                          }
                          actions={
                            <div className="hidden md:flex items-center gap-1.5">
                              {sinMapear && (
                                <Link
                                  href={`/mappings?search=${encodeURIComponent(item.showTitle)}&season=${item.seasonNumber || 1}`}
                                  className="w-8 h-8 rounded-[var(--radius-sm)] bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/35 flex items-center justify-center transition-colors shrink-0"
                                  title={t('history.createMappingForAnime')}
                                >
                                  <Link2 className="w-4 h-4" aria-hidden="true" />
                                </Link>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteAndRevert(item)}
                                disabled={isBatchProcessing || deletingId === item.id}
                                className="w-8 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--status-danger-bg)] hover:border-[var(--status-danger)]/40 text-[var(--text-muted)] hover:text-[var(--status-danger)] flex items-center justify-center transition-colors cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                                title={t('history.revertScrobble')}
                                aria-label={t('history.revertScrobble')}
                              >
                                {deletingId === item.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                ) : (
                                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                                )}
                              </button>
                            </div>
                          }
                        />
                      );
                    })}
                    </ListRows>
                  )}
                </div>

                {/* BARRA DE PAGINACIÓN COMPLETA */}
                {totalPages > 1 && (
                  <div className="pt-4 px-3 sm:px-0 border-t border-[var(--glass-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs font-mono text-[var(--text-muted)]">{t('history.page')}{' '}<strong className="text-[var(--text-primary)]">{page}</strong> {t('history.of')} <strong className="text-[var(--text-primary)]">{totalPages}</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Ir a Primera Página */}
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={page === 1 || loading}
                        className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title={t('mappings.firstPage')}
                      >
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </button>

                      {/* Página Anterior */}
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1 || loading}
                        className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title={t('mappings.previousPage')}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>

                      {/* Números de Página */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = page;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (page <= 3) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            disabled={loading}
                            className={`w-8 h-8 rounded-[6px] text-xs font-semibold transition-all cursor-pointer ${
                              page === pageNum
                                ? 'bg-[var(--color-brand-primary,#FF634A)] text-white shadow-xs'
                                : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      {/* Página Siguiente */}
                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === totalPages || loading}
                        className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title={t('mappings.nextPage')}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Ir a Última Página */}
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        disabled={page === totalPages || loading}
                        className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title={t('mappings.lastPage')}
                      >
                        <ChevronsRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Salto Directo a Página */}
                    <form onSubmit={handleJumpSubmit} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[var(--text-muted)] hidden sm:inline">{t('mappings.goToPage')}</span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        placeholder={String(page)}
                        value={jumpPage}
                        onChange={(e) => setJumpPage(e.target.value)}
                        autoComplete="off"
                        suppressHydrationWarning
                        className="glass-input text-xs font-mono w-14 py-1 text-center"
                      />
                      <button
                        type="submit"
                        disabled={!jumpPage || loading}
                        className="btn-secondary text-xs py-1 px-2.5"
                      >
                        {t('history.goPage')}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMNA DERECHA: RITMO TEMPORAL & MÉTRICAS (4 COLS) */}
            <div className="xl:col-span-4 space-y-4">
              <div className="glass-card p-5 sm:p-6 space-y-4">
                {/* CABECERA CON TOGGLE MES VS RANGO */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--glass-border)]">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[var(--color-brand-primary,#FF634A)]" />
                    <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('history.viewingPace')}</h3>
                  </div>

                  {/* CONMUTADOR DE MODO CON ESTILO DE BOTONES SYNCSEKAI */}
                  <div className="flex items-center p-1 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilterMode('month');
                        setOpenPicker(null);
                      }}
                      className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                        dateFilterMode === 'month'
                          ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold shadow-xs'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >{t('history.byMonth')}</button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilterMode('range');
                      }}
                      className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                        dateFilterMode === 'range'
                          ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold shadow-xs'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {t('history.dateRange')}
                    </button>
                  </div>
                </div>

                {/* MODO 1: NAVEGADOR DE MESES (100% REAL) */}
                {dateFilterMode === 'month' && currentMonthData && (
                  <div className="flex items-center justify-between p-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setSelectedMonthIndex((prev) => Math.max(0, prev - 1))}
                      disabled={selectedMonthIndex === 0}
                      className={`w-8 h-8 rounded-[6px] border flex items-center justify-center transition-all cursor-pointer ${
                        isLightMode
                          ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900'
                          : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                      } disabled:opacity-20 disabled:cursor-not-allowed`}
                      title={
                        selectedMonthIndex > 0
                          ? t('history.previousMonth')
                          : 'Primer mes disponible con registros'
                      }
                    >
                      <ChevronLeft className={`w-4 h-4 shrink-0 ${isLightMode ? 'text-zinc-900' : 'text-zinc-100'}`} />
                    </button>

                    <div className="text-center min-w-0">
                      <div className={`text-sm font-bold font-heading ${isLightMode ? 'text-zinc-950' : 'text-[var(--text-primary)]'}`}>
                        {etiquetaMes(currentMonthData.year, currentMonthData.month, locale)}
                      </div>
                      <div className="text-[10.5px] font-mono text-[var(--text-muted)]">
                        {t('history.scrobblesInMonth', { n: currentMonthData.totalScrobbles })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMonthIndex((prev) =>
                          Math.min(monthsList.length - 1, prev + 1)
                        )
                      }
                      disabled={selectedMonthIndex >= monthsList.length - 1}
                      className={`w-8 h-8 rounded-[6px] border flex items-center justify-center transition-all cursor-pointer ${
                        isLightMode
                          ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900'
                          : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                      } disabled:opacity-20 disabled:cursor-not-allowed`}
                      title={
                        selectedMonthIndex < monthsList.length - 1
                          ? t('history.nextMonth')
                          : t('history.currentMonthNoActivity')
                      }
                    >
                      <ChevronRight className={`w-4 h-4 shrink-0 ${isLightMode ? 'text-zinc-900' : 'text-zinc-100'}`} />
                    </button>
                  </div>
                )}

                {/* MODO 2: SELECTOR DE RANGO DE FECHAS (SIN POPUP BLANCO DEL NAVEGADOR) */}
                {dateFilterMode === 'range' && (
                  <div className="space-y-3 p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] dark-datepicker-container">
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* CAMPO 'DESDE' */}
                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
                          Desde
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpenPicker(openPicker === 'start' ? null : 'start')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-[6px] border text-xs font-mono transition-all cursor-pointer ${
                            isLightMode ? 'bg-white' : 'bg-[var(--bg-app)]'
                          } ${
                            openPicker === 'start'
                              ? 'border-[var(--color-brand-primary,#FF634A)] ring-1 ring-[var(--color-brand-primary,#FF634A)]/50'
                              : isLightMode
                              ? 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'
                              : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                          }`}
                        >
                          <span className={isLightMode ? 'text-zinc-950 font-semibold' : 'text-[var(--text-primary)] font-semibold'}>
                            {formatDateReadable(startDate)}
                          </span>
                          <Calendar className="w-3.5 h-3.5 text-[var(--color-brand-primary,#FF634A)] shrink-0" />
                        </button>

                        {openPicker === 'start' && (
                          <DatePickerPopover
                            title="Seleccionar fecha inicial"
                            currentDate={startDate}
                            minDate={earliestDate}
                            maxDate={endDate || latestDate}
                            availableMonths={monthsList}
                            isLightMode={isLightMode}
                            onSelect={(val) => {
                              setStartDate(val);
                              setActivePreset('custom');
                              setDateWarning(null);
                            }}
                            onClose={() => setOpenPicker(null)}
                          />
                        )}
                      </div>

                      {/* CAMPO 'HASTA' */}
                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
                          Hasta
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpenPicker(openPicker === 'end' ? null : 'end')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-[6px] border text-xs font-mono transition-all cursor-pointer ${
                            isLightMode ? 'bg-white' : 'bg-[var(--bg-app)]'
                          } ${
                            openPicker === 'end'
                              ? 'border-[var(--color-brand-primary,#FF634A)] ring-1 ring-[var(--color-brand-primary,#FF634A)]/50'
                              : isLightMode
                              ? 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'
                              : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                          }`}
                        >
                          <span className={isLightMode ? 'text-zinc-950 font-semibold' : 'text-[var(--text-primary)] font-semibold'}>
                            {formatDateReadable(endDate)}
                          </span>
                          <Calendar className="w-3.5 h-3.5 text-[var(--color-brand-primary,#FF634A)] shrink-0" />
                        </button>

                        {openPicker === 'end' && (
                          <DatePickerPopover
                            title="Seleccionar fecha final"
                            currentDate={endDate}
                            minDate={startDate || earliestDate}
                            maxDate={latestDate}
                            availableMonths={monthsList}
                            isLightMode={isLightMode}
                            onSelect={(val) => {
                              setEndDate(val);
                              setActivePreset('custom');
                              setDateWarning(null);
                            }}
                            onClose={() => setOpenPicker(null)}
                          />
                        )}
                      </div>
                    </div>

                    {/* ACCESOS RÁPIDOS CON ESTILO DE BOTONES SYNCSEKAI */}
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const today = latestDate || new Date().toISOString().slice(0, 10);
                          setStartDate(today.slice(0, 8) + '01');
                          setEndDate(today);
                          setActivePreset('month');
                          setDateWarning(null);
                          setOpenPicker(null);
                        }}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                          activePreset === 'month'
                            ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold shadow-xs'
                            : 'btn-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>{t('history.thisMonth')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                          setStartDate(d30);
                          setEndDate(latestDate);
                          setActivePreset('last30');
                          setDateWarning(null);
                          setOpenPicker(null);
                        }}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                          activePreset === 'last30'
                            ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold shadow-xs'
                            : 'btn-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>{t('history.lastThirtyDays')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setStartDate(earliestDate);
                          setEndDate(latestDate);
                          setActivePreset('all');
                          setDateWarning(null);
                          setOpenPicker(null);
                        }}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                          activePreset === 'all'
                            ? 'bg-amber-500 text-black font-bold shadow-xs'
                            : isLightMode
                            ? 'bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-bold'
                            : 'btn-secondary text-amber-300 border-amber-500/35 hover:border-amber-500/60'
                        }`}
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isLightMode ? 'text-amber-800' : 'text-amber-400'}`} />
                        <span>{t('history.allHistory')}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* INSIGNIA INFORMATIVA DE LÍMITES */}
                <div
                  className={`flex items-center gap-1.5 p-2.5 rounded-[6px] border text-[10.5px] font-mono truncate ${
                    isLightMode
                      ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold'
                      : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                  }`}
                >
                  <Lock
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isLightMode ? 'text-amber-800' : 'text-amber-400'
                    }`}
                  />
                  <span>{t('history.historyRange', { from: formatDateReadable(earliestDate), to: formatDateReadable(latestDate) })}</span>
                </div>

                {/* HEATMAP GRID INTERACTIVO */}
                <div className="space-y-1.5">
                  <div
                    className={`grid grid-cols-7 gap-1.5 p-3 rounded-[8px] border ${
                      isLightMode
                        ? 'bg-white border-zinc-200'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {(currentMonthData?.days || []).map((item) => {
                      const tierClass = getHeatmapTierClass(item.tier, isLightMode);

                      return (
                        <div
                          key={item.day}
                          onMouseEnter={() => setHoveredDay(item)}
                          onMouseLeave={() => setHoveredDay(null)}
                          className={`aspect-square rounded-[5px] border flex items-center justify-center text-[10px] font-mono cursor-pointer transition-all duration-150 hover:scale-115 hover:border-[var(--color-brand-primary,#FF634A)] hover:z-10 ${tierClass} ${
                            item.isToday
                              ? 'ring-2 ring-[var(--color-brand-primary,#FF634A)] ring-offset-1 ring-offset-[var(--bg-surface)]'
                              : ''
                          } ${item.isFuture ? 'opacity-25 pointer-events-none' : ''}`}
                        >
                          {item.day}
                        </div>
                      );
                    })}
                  </div>

                  {/* Tooltip Dinámico */}
                  <div
                    className={`h-4 flex items-center justify-center text-[11px] font-mono font-semibold ${
                      isLightMode ? 'text-zinc-950' : 'text-amber-400'
                    }`}
                  >
                    {hoveredDay ? (
                      <span>
                        Día {hoveredDay.day}: {hoveredDay.count}{' '}
                        {hoveredDay.count === 1
                          ? 'scrobble registrado'
                          : 'scrobbles registrados'}
                      </span>
                    ) : (
                      <span
                        className={
                          isLightMode
                            ? 'text-zinc-500 text-[10.5px]'
                            : 'text-[var(--text-muted)] text-[10.5px]'
                        }
                      >{t('history.hoverOverDay')}</span>
                    )}
                  </div>
                </div>

                {/* Leyenda */}
                <div className="flex items-center justify-between text-[10.5px] font-mono text-[var(--text-muted)] pt-0.5">
                  <span>{t('history.lessActive')}</span>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]" />
                    <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-500/20 border border-amber-500/30" />
                    <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-500/45 border border-amber-500/60" />
                    <span className="w-2.5 h-2.5 rounded-[2px] bg-orange-500/75 border border-orange-500/90" />
                    <span className="w-2.5 h-2.5 rounded-[2px] bg-orange-500 border border-orange-200" />
                  </div>
                  <span>{t('history.moreActive')}</span>
                </div>

                {/* Tarjetas de Insights */}
                <div className="space-y-2.5 pt-2 border-t border-[var(--glass-border)]">
                  <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-3 hover:border-[var(--border-strong)] transition-all">
                    <div className="w-8 h-8 rounded-[6px] bg-orange-500/15 text-orange-400 border border-orange-500/25 flex items-center justify-center shrink-0">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] font-heading">
                        {t('history.bestStreak', { n: heatmapData?.bestStreak || 0 })}
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {t('history.currentStreak', { n: heatmapData?.currentStreak || 0 })}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-3 hover:border-[var(--border-strong)] transition-all">
                    <div className="w-8 h-8 rounded-[6px] bg-sky-500/15 text-sky-400 border border-sky-500/25 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] font-heading">
                        {t('history.mainTracker')}: {resumen?.trackerPrincipal?.nombre || t('history.noData')}
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {resumen?.trackerPrincipal
                          ? t('history.mainTrackerShare', { p: resumen.trackerPrincipal.porcentaje })
                          : t('history.noTrackerYet')}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-3 hover:border-[var(--border-strong)] transition-all">
                    <div className="w-8 h-8 rounded-[6px] bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] font-heading">{t('history.mostActiveTime')}</h4>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {resumen?.franjaActiva
                          ? t('history.activeRange', {
                              desde: String(resumen.franjaActiva.desde).padStart(2, '0'),
                              hasta: String(resumen.franjaActiva.hasta).padStart(2, '0'),
                            })
                          : t('history.noActivityYet')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* BOTTOM SHEET NATIVO MÓVIL PARA HISTORIAL */}
      {activeHistorySheetItem && (
        <BottomSheet
          isOpen={!!activeHistorySheetItem}
          onClose={() => setActiveHistorySheetItem(null)}
          title={activeHistorySheetItem.showTitle}
          subtitle={`${t('history.sheetEpisode', { n: activeHistorySheetItem.episodeNumber })} • ${
            activeHistorySheetItem.librarySectionTitle
              || (activeHistorySheetItem.source === 'JELLYFIN'
                ? 'Jellyfin'
                : activeHistorySheetItem.source === 'EMBY'
                ? 'Emby'
                : activeHistorySheetItem.source === 'PLEX'
                ? 'Plex'
                : t('history.libraryUnknown'))
          }`}
          headerImage={
            resolveCoverUrl(activeHistorySheetItem.coverImage) ? (
              <img
                src={resolveCoverUrl(activeHistorySheetItem.coverImage)!}
                alt={activeHistorySheetItem.showTitle}
                className="w-10 h-14 rounded-[6px] object-cover border border-[var(--border-subtle)] shadow-sm shrink-0 bg-[var(--bg-app)]"
              />
            ) : (
              <div className="w-10 h-14 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                <Film className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            )
          }
          headerBadge={
            <span className="badge-pill font-mono text-[10px]">
              {activeHistorySheetItem.seasonNumber && activeHistorySheetItem.seasonNumber > 1
                ? `T${activeHistorySheetItem.seasonNumber} Ep.${activeHistorySheetItem.episodeNumber}`
                : `Ep.${activeHistorySheetItem.episodeNumber}`}
            </span>
          }
          actions={[
            ...(!activeHistorySheetItem.isMapped && !activeHistorySheetItem.anilistMediaId && (activeHistorySheetItem.anilistStatus === 'SKIPPED' || activeHistorySheetItem.anilistStatus === 'FAILED' || activeHistorySheetItem.malStatus === 'FAILED')
              ? [
                  {
                    label: t('history.mapAnimeAction'),
                    sublabel: t('history.associateInMappings'),
                    icon: Link2,
                    iconColor: 'text-purple-400',
                    onClick: () => {
                      setActiveHistorySheetItem(null);
                      router.push(
                        `/mappings?search=${encodeURIComponent(activeHistorySheetItem.showTitle)}&season=${activeHistorySheetItem.seasonNumber || 1}`,
                      );
                    },
                  },
                ]
              : []),
            {
              label: t('history.revertScrobbleAction'),
              sublabel: t('history.subtractEpisodeDesc'),
              icon: RotateCcw,
              variant: 'danger',
              onClick: () => handleDeleteAndRevert(activeHistorySheetItem),
            },
            ...(activeHistorySheetItem.anilistMediaId
              ? [
                  {
                    label: t('mappings.viewOnAniList'),
                    sublabel: t('history.openAniListSheet', { id: activeHistorySheetItem.anilistMediaId }),
                    icon: ExternalLink,
                    iconColor: 'text-[var(--brand-anilist)]',
                    onClick: () => {
                      window.open(`https://anilist.co/anime/${activeHistorySheetItem.anilistMediaId}`, '_blank');
                    },
                  },
                ]
              : []),
            ...(activeHistorySheetItem.malMediaId
              ? [
                  {
                    label: t('catalog.viewOnMal'),
                    sublabel: t('history.openMalSheet', { id: activeHistorySheetItem.malMediaId }),
                    icon: ExternalLink,
                    iconColor: 'text-[var(--brand-mal)]',
                    onClick: () => {
                      window.open(`https://myanimelist.net/anime/${activeHistorySheetItem.malMediaId}`, '_blank');
                    },
                  },
                ]
              : []),
            {
              label: t('history.copyPlexTitle'),
              sublabel: activeHistorySheetItem.showTitle,
              icon: Copy,
              onClick: () => {
                navigator.clipboard.writeText(activeHistorySheetItem.showTitle);
                showToast(t('history.titleCopied'), 'info');
              },
            },
          ]}
        >
          {/* Estado: tres iconos con su marca, y el resto en una linea gris. */}
          <div className="space-y-2.5">
            <SyncStatus
              vinculados={vinculados}
              anilist={activeHistorySheetItem.anilistStatus}
              mal={activeHistorySheetItem.malStatus}
              kitsu={activeHistorySheetItem.kitsuStatus}
              etiquetas={etiquetasSync(activeHistorySheetItem, t)}
            />
            <p className="text-[11px] font-mono text-[var(--text-muted)]">
              {Math.round(activeHistorySheetItem.viewPercentage || 95)}%{' '}
              {t('history.watchedSuffix')}
              {activeHistorySheetItem.rating ? ` · ★ ${activeHistorySheetItem.rating}/10` : ''}
            </p>
          </div>
        </BottomSheet>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText || t('common.confirm')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
