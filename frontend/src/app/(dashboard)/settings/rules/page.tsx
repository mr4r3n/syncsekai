'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useUnsavedChanges } from '@/components/UnsavedChangesProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Sliders,
  Percent,
  Sparkles,
  Save,
  Loader2,
  CheckCircle2,
  Calculator,
  Play,
  Clock,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CustomSelect } from '@/components/CustomSelect';
import { Switch } from '@/components/Switch';

export default function RulesSettingsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();
  const { setDirty, registerSaveHandler } = useUnsavedChanges();

  const [loading, setLoading] = useState(true);
  const [completionPercentage, setCompletionPercentage] = useState(80);
  const [syncRatings, setSyncRatings] = useState(true);
  const [autoApproveMappings, setAutoApproveMappings] = useState(true);
  const [preferredTracker, setPreferredTracker] = useState('BOTH');
  const [initialSettings, setInitialSettings] = useState<{
    completionPercentage: number;
    syncRatings: boolean;
    autoApproveMappings: boolean;
    preferredTracker: string;
  } | null>(null);
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Simulador interactivo de minutos
  const [sampleDurationMinutes, setSampleDurationMinutes] = useState(24);

  const isDirty = Boolean(
    initialSettings &&
      (completionPercentage !== initialSettings.completionPercentage ||
        syncRatings !== initialSettings.syncRatings ||
        autoApproveMappings !== initialSettings.autoApproveMappings ||
        preferredTracker !== initialSettings.preferredTracker)
  );

  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty, setDirty]);

  useEffect(() => {
    if (isDirty) {
      registerSaveHandler(async () => {
        await api.auth.updateSettings({
          completionPercentage,
          syncRatings,
          autoApproveMappings,
          preferredTracker,
        });
        setInitialSettings({
          completionPercentage,
          syncRatings,
          autoApproveMappings,
          preferredTracker,
        });
        showToast(t('rules.rulesUpdated'), 'success');
        return true;
      });
    } else {
      registerSaveHandler(null);
    }
  }, [isDirty, completionPercentage, syncRatings, autoApproveMappings, preferredTracker, registerSaveHandler, showToast]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.auth.me();
      const user = res?.user || res;
      if (!user) {
        router.push('/login');
        return;
      }

      const settingsObj = user.settings || user.preferences;
      if (settingsObj) {
        const cp = settingsObj.completionPercentage ?? 80;
        const sr = settingsObj.syncRatings ?? true;
        const aam = settingsObj.autoApproveMappings ?? true;
        const pt = settingsObj.preferredTracker || 'BOTH';

        setCompletionPercentage(cp);
        setSyncRatings(sr);
        setAutoApproveMappings(aam);
        setPreferredTracker(pt);
        setInitialSettings({
          completionPercentage: cp,
          syncRatings: sr,
          autoApproveMappings: aam,
          preferredTracker: pt,
        });
      }
    } catch (e: any) {
      showToast(e.message || t('rules.loadRulesError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSavingPreferences(true);
      await api.auth.updateSettings({
        completionPercentage,
        syncRatings,
        autoApproveMappings,
        preferredTracker,
      });
      setInitialSettings({
        completionPercentage,
        syncRatings,
        autoApproveMappings,
        preferredTracker,
      });
      showToast(t('rules.rulesUpdated'), 'success');
    } catch (e: any) {
      showToast(t('rules.somethingWentWrong'), 'error');
    } finally {
      setSavingPreferences(false);
    }
  };

  // Cálculo del tiempo de disparo para el simulador
  const calculateTriggerTime = () => {
    const totalSeconds = sampleDurationMinutes * 60;
    const triggerSeconds = Math.round((totalSeconds * completionPercentage) / 100);
    const mins = Math.floor(triggerSeconds / 60);
    const secs = triggerSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('topbar.settings')} currentLabel={t('rules.title')} />

      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('rules.title')}</h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('rules.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL EN DOS COLUMNAS BALANCEADAS */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-8 min-w-0">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-text)]" />
            <span className="text-xs font-mono text-[var(--text-muted)]">{t('rules.loadingRules')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUMNA IZQUIERDA: PARÁMETROS Y FORMULARIO (7 COLS) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="glass-card p-6 sm:p-7 space-y-6">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('rules.sectionDetection')}</h2>
                    <p className="text-xs text-[var(--text-secondary)]">{t('rules.detectionParams')}</p>
                  </div>
                </div>

                <form onSubmit={handleSavePreferences} className="space-y-5 pt-1">
                  {/* Slider: Porcentaje mínimo de scrobble */}
                  <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5 text-emerald-400" />{t('rules.minWatchThreshold')}</span>
                      <span className="font-mono font-bold text-emerald-400 text-xs px-2 py-0.5 rounded-[4px] bg-emerald-500/10 border border-emerald-500/20">
                        {completionPercentage}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="50"
                      max="95"
                      step="5"
                      value={completionPercentage}
                      onChange={(e) => setCompletionPercentage(Number(e.target.value))}
                      className="w-full accent-[var(--accent-primary)] cursor-pointer h-2 bg-[var(--bg-surface-elevated)] rounded-[6px]"
                    />

                    {/* Presets rápidos */}
                    <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)] pt-1">
                      <span>{t('rules.flexible')}</span>
                      <div className="flex items-center gap-1.5">
                        {[70, 80, 90].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCompletionPercentage(val)}
                            className={
                              completionPercentage === val
                                ? 'filter-tab-active !h-7 !text-xs !px-2.5'
                                : 'filter-tab !h-7 !text-xs !px-2.5'
                            }
                          >
                            {val}%
                          </button>
                        ))}
                      </div>
                      <span>{t('rules.strict')}</span>
                    </div>
                  </div>

                  {/* Switch: Sincronizar Calificaciones */}
                  <div className="p-4 rounded-[var(--radius-md,6px)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />{t('rules.syncRatingsTitle')}</div>
                      <p className="text-xs text-[var(--text-secondary)]">{t('rules.syncRatingsDescription')}</p>
                    </div>
                    <Switch
                      checked={syncRatings}
                      onChange={setSyncRatings}
                      ariaLabel={t('rules.syncRatingsTitle')}
                    />
                  </div>

                  {/* Switch: Auto-aprobar mapeos exactos */}
                  <div className="p-4 rounded-[var(--radius-md,6px)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[var(--text-primary)]">{t('rules.autoApproveExact')}</div>
                      <p className="text-xs text-[var(--text-secondary)]">{t('rules.autoApproveDesc')}</p>
                    </div>
                    <Switch
                      checked={autoApproveMappings}
                      onChange={setAutoApproveMappings}
                      ariaLabel={t('rules.autoApproveExact')}
                    />
                  </div>

                  {/* Tracker Preferido */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('rules.preferredTracker')}</label>
                    <CustomSelect
                      value={preferredTracker}
                      onChange={setPreferredTracker}
                      accentColor="emerald"
                      options={[
                        { value: 'BOTH', label: t('rules.engineDual') },
                        { value: 'ANILIST', label: t('rules.engineAniListOnly') },
                        { value: 'MAL', label: t('rules.engineMalOnly') },
                        { value: 'KITSU', label: t('rules.engineKitsuOnly') },
                      ]}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingPreferences}
                    className="btn-primary w-full py-2.5"
                  >
                    {savingPreferences ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{t('rules.saveRules')}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* COLUMNA DERECHA: SIMULADOR EN VIVO (5 COLS) */}
            <div className="lg:col-span-5 space-y-6">
              {/* CARD: SIMULADOR DE SCROBBLE */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--glass-border)]">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('rules.liveSimulator')}</h3>
                      <p className="text-[11px] text-[var(--text-muted)]">{t('rules.calculatorHint')}</p>
                    </div>
                  </div>
                  <span className="badge-pill">
                    {t('rules.calculatorBadge')}
                  </span>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {t('rules.calculatorIntro', { pct: completionPercentage })}
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--text-secondary)] flex items-center justify-between">
                      <span>{t('rules.episodeDuration')}</span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">{sampleDurationMinutes} min</span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="120"
                      step="1"
                      value={sampleDurationMinutes}
                      onChange={(e) => setSampleDurationMinutes(Number(e.target.value))}
                      className="w-full accent-[var(--accent-primary)] cursor-pointer h-1.5 bg-[var(--bg-surface-elevated)] rounded-[6px]"
                    />
                  </div>

                  {/* Barra de progreso de simulación */}
                  <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                        <Play className="w-3 h-3 text-emerald-400" />{t('rules.scrobbleTrigger')}</span>
                      <span className="font-bold text-emerald-400 text-xs">
                        {t('rules.minuteN', { n: calculateTriggerTime() })}
                      </span>
                    </div>

                    <div className="w-full h-3 rounded-full bg-[var(--bg-surface-elevated)] overflow-hidden relative border border-[var(--border-subtle)]">
                      <div
                        style={{ width: `${completionPercentage}%` }}
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300 relative"
                      >
                        <span className="absolute right-1 top-0 bottom-0 flex items-center text-[9px] font-bold text-black font-mono">
                          {completionPercentage}%
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[var(--text-muted)] leading-tight font-mono">
                      {t('rules.triggerExplanation', { pct: completionPercentage })}
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD: POLÍTICAS DE CALIDAD */}
              <div className="glass-card p-6 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] font-heading">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  <span>{t('rules.enginePolicies')}</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">{t('rules.antiDuplication')}</span>
                    <span className="font-mono font-bold text-emerald-400">{t('notifications.active')}</span>
                  </div>

                  <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">{t('rules.retriesWithBackoff')}</span>
                    <span className="font-mono font-bold text-[var(--accent-text)]">{t('rules.retriesMax', { n: 3 })}</span>
                  </div>

                  <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">{t('rules.statePreservation')}</span>
                    <span className="font-mono font-bold text-emerald-400">{t('rules.enabled')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
