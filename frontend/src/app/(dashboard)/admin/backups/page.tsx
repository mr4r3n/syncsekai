'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, getApiBase } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { CustomSelect } from '@/components/CustomSelect';
import { Switch } from '@/components/Switch';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  HardDrive,
  Database,
  Archive,
  Download,
  RotateCcw,
  Trash2,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  Upload,
  RefreshCw,
  Sliders,
  FileCheck,
  HelpCircle,
  FolderArchive,
  FileText,
  Radio,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useModalA11y } from '@/components/useModalA11y';

export default function AdminBackupsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any>({
    enabled: false,
    frequency: 'DAILY',
    time: '03:00',
    includeMedia: true,
    retentionCount: 7,
    lastRunAt: null,
  });
  const [totalBackups, setTotalBackups] = useState(0);
  const [storageUsed, setStorageUsed] = useState('0 B');
  const [backupFilter, setBackupFilter] = useState<'ALL' | 'DATABASE' | 'FULL_SYSTEM'>('ALL');

  // Creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingType, setCreatingType] = useState<'DATABASE' | 'FULL_SYSTEM'>('DATABASE');
  const [creating, setCreating] = useState(false);

  // Restore modal state
  const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Upload restore modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Schedule saving state
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Semántica de diálogo y gestión de foco de los modales de esta vista.
  const { dialogProps: propsCrear } = useModalA11y(Boolean(showCreateModal), () => setShowCreateModal(false));
  const { dialogProps: propsRestaurar } = useModalA11y(Boolean(restoreTarget), () => setRestoreTarget(null));
  const { dialogProps: propsSubir } = useModalA11y(Boolean(showUploadModal), () => setShowUploadModal(false));
  const { dialogProps: propsBorrar } = useModalA11y(Boolean(deleteTarget), () => setDeleteTarget(null));

  useEffect(() => {
    loadBackupsData();
  }, []);

  const loadBackupsData = async () => {
    try {
      setLoading(true);
      const meRes = await api.auth.me().catch(() => null);
      const meUser = meRes?.user || meRes;
      if (!meUser || meUser.role !== 'ADMIN') {
        showToast(t('admin.adminRequired'), 'error');
        router.push('/catalog');
        return;
      }

      const res = await api.admin.getBackups();
      setBackups(res.backups || []);
      if (res.schedule) {
        setSchedule(res.schedule);
      }
      setTotalBackups(res.totalBackups || 0);
      setStorageUsed(res.storageUsedFormatted || '0 B');
    } catch (err: any) {
      showToast(`${t('backups.loadBackupsError')} ` + err.message, 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      const res = await api.admin.createBackup(creatingType);
      showToast(`¡Copia de seguridad ${res.filename} generada con éxito!`, 'success');
      setShowCreateModal(false);
      await loadBackupsData();
    } catch (err: any) {
      showToast(`${t('backups.generateBackupError')} ` + err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSchedule(true);
      const res = await api.admin.saveBackupSchedule({
        enabled: schedule.enabled,
        frequency: schedule.frequency,
        time: schedule.time,
        includeMedia: schedule.includeMedia,
        retentionCount: Number(schedule.retentionCount) || 7,
      });
      setSchedule(res.schedule);
      showToast(t('backups.scheduleSaved'), 'success');
    } catch (err: any) {
      showToast(`${t('backups.saveScheduleError')} ` + err.message, 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDownload = (filename: string) => {
    api.admin
      .downloadBackup(filename)
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        showToast(`Descargando ${filename}…`, 'info');
      })
      .catch((err) => {
        showToast(`${t('backups.downloadError')} ` + err.message, 'error');
      });
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      setRestoring(true);
      const res = await api.admin.restoreBackup(restoreTarget.filename);
      showToast(`¡Restauración exitosa! Se procesaron ${res.restoredRecords} registros.`, 'success');
      setRestoreTarget(null);
      await loadBackupsData();
    } catch (err: any) {
      showToast(`${t('backups.restoreError')} ` + err.message, 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleUploadAndRestore = async () => {
    if (!uploadFile) {
      showToast(t('backups.selectBackupFile'), 'error');
      return;
    }
    try {
      setUploading(true);
      const res = await api.admin.uploadAndRestoreBackup(uploadFile);
      showToast(`¡Archivo restaurado con éxito! Se procesaron ${res.restoredRecords} registros.`, 'success');
      setShowUploadModal(false);
      setUploadFile(null);
      await loadBackupsData();
    } catch (err: any) {
      showToast(`${t('backups.restoreUploadError')} ` + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.admin.deleteBackup(deleteTarget.filename);
      showToast(`Copia ${deleteTarget.filename} eliminada correctamente.`, 'info');
      setDeleteTarget(null);
      await loadBackupsData();
    } catch (err: any) {
      showToast(`${t('backups.deleteBackupError')} ` + err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.backupsTitle')} />

      <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 outline-none">
          {/* HEADER PRINCIPAL */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[6px] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-text)]">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-heading">{t('backups.title')}</h1>
                  <p className="text-xs text-[var(--text-secondary)]">{t('backups.subtitle')}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setIsRefreshing(true);
                  loadBackupsData();
                }}
                disabled={isRefreshing || loading}
                className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
                title={t('backups.refreshData')}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[var(--accent-text)]' : ''}`} />
              </button>

              <button
                onClick={() => setShowUploadModal(true)}
                className="px-3.5 py-2 rounded-[var(--radius-md)] text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                <span>{t('backups.uploadAndRestore')}</span>
              </button>

              <button
                onClick={() => {
                  setCreatingType('DATABASE');
                  setShowCreateModal(true);
                }}
                className="px-3.5 py-2 rounded-[var(--radius-md)] text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                <span>{t('backups.extractDatabase')}</span>
              </button>

              <button
                onClick={() => {
                  setCreatingType('FULL_SYSTEM');
                  setShowCreateModal(true);
                }}
                className="px-4 py-2 rounded-[6px] text-xs font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-md shadow-[var(--accent-primary)]/20 transition-all flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
              >
                <Archive className="w-4 h-4" />
                <span>{t('backups.fullMigrationCopy')}</span>
              </button>
            </div>
          </div>

          {/* BANNER GUÍA DE MIGRACIÓN */}
          <div className="p-4 rounded-[6px] border border-purple-500/30 bg-purple-500/5 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 rounded-[4px] bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[var(--text-primary)] font-heading">{t('backups.migratingQuestion')}</span>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{t('backups.generateA')}{' '}<strong>{t('backups.fullMigrationCopy')}</strong>{' '}{t('backups.migrationExplain')}{' '}<strong>{t('backups.uploadAndRestore')}</strong>{' '}{t('backups.systemReadyInstantly')}</p>
              </div>
            </div>
          </div>

          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-5 rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
                <span>{t('backups.availableCopies')}</span>
                <Archive className="w-4 h-4 text-[var(--accent-text)]" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text-primary)]">
                {totalBackups}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">{t('backups.filesStoredOnDisk')}</p>
            </div>

            <div className="p-5 rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
                <span>{t('backups.spaceUsed')}</span>
                <HardDrive className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text-primary)]">
                {storageUsed}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">{t('backups.gzipLevelNine')}</p>
            </div>

            <div className="p-5 rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-1.5 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
                <span>{t('backups.automaticSchedule')}</span>
                <Calendar className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    schedule.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--text-muted)]'
                  }`}
                />
                <div className="text-xl sm:text-2xl font-bold font-heading text-[var(--text-primary)]">
                  {/* La frecuencia venia cruda del enum: en la tarjeta se leia
                      "DAILY" en mayusculas junto a textos traducidos. */}
                  {schedule.enabled ? t(`backups.freq${schedule.frequency}`) : t('backups.inactive')}
                </div>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {schedule.enabled
                  ? t('backups.scheduleSummary', { time: schedule.time, n: schedule.retentionCount })
                  : t('backups.noAutoScheduled')}
              </p>
            </div>
          </div>

          {/* GRID DE DOS COLUMNAS: CONFIGURACIÓN CRON + LISTA DE BACKUPS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* COLUMNA 1: CONFIGURACIÓN DE PROGRAMACIÓN */}
            <div className="p-6 rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-5">
              <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border-subtle)]">
                <Sliders className="w-4 h-4 text-[var(--accent-text)]" />
                <h2 className="text-sm font-bold tracking-tight font-heading">{t('backups.automaticSchedule')}</h2>
              </div>

              <form onSubmit={handleSaveSchedule} className="space-y-4">
                {/* Switch Activación */}
                <div className="flex items-center justify-between p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{t('backups.enableAutoBackups')}</span>
                    <p className="text-[11px] text-[var(--text-muted)]">{t('backups.unattendedCron')}</p>
                  </div>
                  <Switch
                    checked={schedule.enabled}
                    onChange={(v) => setSchedule({ ...schedule, enabled: v })}
                    ariaLabel={t('backups.enableAutoBackups')}
                  />
                </div>

                {/* Frecuencia */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">{t('backups.frequency')}</label>
                  <CustomSelect
                    value={schedule.frequency}
                    onChange={(val) => setSchedule({ ...schedule, frequency: val })}
                    options={[
                      { value: 'HOURLY', label: t('backups.everyHour') },
                      { value: 'DAILY', label: t('backups.dailyRecommended') },
                      { value: 'WEEKLY', label: t('backups.weekly') },
                      { value: 'MONTHLY', label: t('backups.monthly') },
                    ]}
                    accentColor="cinnabar"
                  />
                </div>

                {/* Hora de Ejecución */}
                <div className="space-y-1.5">
                  <label htmlFor="copia-hora-ejecucion" className="text-xs font-medium text-[var(--text-secondary)]">{t('backups.executionTime')}</label>
                  <div className="relative">
                    <input
                      id="copia-hora-ejecucion"
                      type="time"
                      value={schedule.time}
                      onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                      disabled={!schedule.enabled || schedule.frequency === 'HOURLY'}
                      className="w-full h-[36px] min-h-[36px] px-3.5 rounded-[6px] text-xs border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] disabled:opacity-50 font-mono"
                    />
                  </div>
                </div>

                {/* Retención */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">{t('backups.retention')}</label>
                  <CustomSelect
                    value={String(schedule.retentionCount)}
                    onChange={(val) => setSchedule({ ...schedule, retentionCount: Number(val) })}
                    options={[
                      { value: '3', label: t('backups.keepLast', { n: 3 }) },
                      { value: '7', label: t('backups.keepLast', { n: 7 }) },
                      { value: '14', label: t('backups.keepLast', { n: 14 }) },
                      { value: '30', label: t('backups.keepLast', { n: 30 }) },
                      { value: '60', label: t('backups.keepLast', { n: 60 }) },
                    ]}
                    accentColor="cinnabar"
                  />
                  <p className="text-[10.5px] text-[var(--text-muted)]">{t('backups.retentionDesc')}</p>
                </div>

                {/* Incluir Archivos Multimedia */}
                <div className="flex items-center justify-between p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {t('backups.includeMedia')}
                    </span>
                    <p className="text-[11px] text-[var(--text-muted)]">{t('backups.avatarsAndPosters')}</p>
                  </div>
                  <Switch
                    checked={schedule.includeMedia && schedule.enabled}
                    onChange={(v) => setSchedule({ ...schedule, includeMedia: v })}
                    disabled={!schedule.enabled}
                    ariaLabel={t('backups.includeMedia')}
                  />
                </div>

                {schedule.lastRunAt && (
                  <div className="p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-mono text-[var(--text-secondary)] space-y-1">
                    <div className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">{t('backups.lastAutomaticRun')}</div>
                    <div>{formatDateTime(schedule.lastRunAt)}</div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingSchedule}
                  className="w-full py-2.5 rounded-[6px] text-xs font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-md shadow-[var(--accent-primary)]/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingSchedule ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{t('backups.saveSchedule')}</span>
                </button>
              </form>
            </div>

            {/* COLUMNA 2: LISTA DE COPIAS DE SEGURIDAD */}
            <div className="lg:col-span-2 p-6 rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setBackupFilter('ALL')}
                    className={`px-2.5 py-1 rounded-[var(--radius-md)] text-xs font-semibold transition-colors cursor-pointer border ${
                      backupFilter === 'ALL'
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {t('backups.filterAll', { n: backups.length })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackupFilter('DATABASE')}
                    className={`px-2.5 py-1 rounded-[var(--radius-md)] text-xs font-semibold transition-colors cursor-pointer border ${
                      backupFilter === 'DATABASE'
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {t('backups.filterDatabase', { n: backups.filter((b) => b.type === 'DATABASE').length })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackupFilter('FULL_SYSTEM')}
                    className={`px-2.5 py-1 rounded-[var(--radius-md)] text-xs font-semibold transition-colors cursor-pointer border ${
                      backupFilter === 'FULL_SYSTEM'
                        ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {t('backups.filterFullSystem', { n: backups.filter((b) => b.type === 'FULL_SYSTEM').length })}
                  </button>
                </div>

                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  {t('backups.formatNote')}
                </span>
              </div>

              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
                  <Loader2 className="w-7 h-7 animate-spin text-[var(--accent-text)]" />
                  <span className="text-xs font-mono">{t('backups.loadingBackups')}</span>
                </div>
              ) : backups.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[var(--accent-text)] flex items-center justify-center mx-auto">
                    <FolderArchive className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('backups.noBackupsYet')}</h3>
                  <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">{t('backups.noBackupsDesc')}</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 rounded-[6px] text-xs font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-md shadow-[var(--accent-primary)]/20 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('backups.createFirst')}</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-mono text-[11px]">
                        <th scope="col" className="pb-3 pl-3.5 pr-3 font-semibold">{t('backups.fileAndType')}</th>
                        <th scope="col" className="pb-3 px-3 font-semibold">{t('backups.origin')}</th>
                        <th scope="col" className="pb-3 px-3 font-semibold">{t('backups.size')}</th>
                        <th scope="col" className="pb-3 px-3 font-semibold">{t('backups.creationDate')}</th>
                        <th scope="col" className="pb-3 pl-3 pr-3.5 font-semibold text-right">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {backups
                        .filter((b) => {
                          if (backupFilter === 'DATABASE') return b.type === 'DATABASE';
                          if (backupFilter === 'FULL_SYSTEM') return b.type === 'FULL_SYSTEM';
                          return true;
                        })
                        .map((item) => (
                        <tr
                          key={item.filename}
                          className="hover:bg-[var(--bg-surface-hover)] transition-colors group"
                        >
                          <td className="py-3 pl-3.5 pr-3 first:rounded-l-[6px]">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 ${
                                  item.type === 'FULL_SYSTEM'
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                }`}
                              >
                                {item.type === 'FULL_SYSTEM' ? (
                                  <Archive className="w-4 h-4" />
                                ) : (
                                  <Database className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-mono text-xs font-bold text-[var(--text-primary)] truncate max-w-[220px] sm:max-w-xs">
                                  {item.filename}
                                </div>
                                <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-2">
                                  <span className={item.type === 'FULL_SYSTEM' ? 'text-purple-400 font-semibold' : 'text-sky-400 font-semibold'}>
                                    {item.type === 'FULL_SYSTEM'
                                      ? t('backups.fullSystemMigration')
                                      : t('backups.databaseOnly')}
                                  </span>
                                  {item.totalRecords > 0 && (
                                    <>
                                      <span>&bull;</span>
                                      <span>{t('backups.recordsCount', { n: item.totalRecords })}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-bold uppercase ${
                                item.source === 'SCHEDULED'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : item.source === 'IMPORTED'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border border-[var(--accent-primary)]/20'
                              }`}
                            >
                              {item.source === 'SCHEDULED'
                                ? t('backups.sourceScheduled')
                                : item.source === 'IMPORTED'
                                ? t('backups.sourceUploaded')
                                : t('backups.sourceManual')}
                            </span>
                          </td>

                          <td className="py-3 px-3 font-mono text-xs font-bold text-[var(--text-primary)]">
                            {item.sizeFormatted}
                          </td>

                          <td className="py-3 px-3 font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                            {formatDateTime(item.createdAt)}
                          </td>

                          <td className="py-3 pl-3 pr-3.5 text-right last:rounded-r-[6px]">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Descargar */}
                              <button
                                onClick={() => handleDownload(item.filename)}
                                className="p-1.5 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                title={t('backups.downloadBackup')}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              {/* Restaurar */}
                              <button
                                onClick={() => setRestoreTarget(item)}
                                className="p-1.5 rounded-[4px] border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                                title={t('backups.restoreToThisPoint')}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>

                              {/* Eliminar */}
                              <button
                                onClick={() => setDeleteTarget(item)}
                                className="p-1.5 rounded-[4px] border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                                title={t('backups.deleteBackupFile')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>

      {/* ========================================================= */}
      {/* MODAL: CREAR COPIA DE SEGURIDAD                           */}
      {/* ========================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            {...propsCrear}
            className="w-full max-w-md p-6 rounded-[6px] border border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] backdrop-blur-2xl shadow-2xl space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)]">
              <div className="w-9 h-9 rounded-[6px] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-text)]">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading text-[var(--text-primary)]">{t('backups.createManualBackup')}</h3>
                <p className="text-xs text-[var(--text-muted)]">{t('backups.selectScope')}</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Opción 1: Base de Datos */}
              <div
                onClick={() => setCreatingType('DATABASE')}
                className={`p-4 rounded-[6px] border transition-all cursor-pointer flex items-start gap-3 ${
                  creatingType === 'DATABASE'
                    ? 'border-sky-500 bg-sky-500/10 shadow-sm'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <div className="w-9 h-9 rounded-[6px] bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Database className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)] font-heading">{t('backups.postgresOnly')}</span>
                    <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">{t('backups.fastSize')}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{t('backups.postgresOnlyDesc')}</p>
                  <ul className="text-[10.5px] text-[var(--text-muted)] space-y-0.5 font-mono">
                    <li>{t('backups.bulletUsersTokens')}</li>
                    <li>{t('backups.bulletScrobblesMappings')}</li>
                    <li>{t('backups.bulletSystemConfig')}</li>
                  </ul>
                </div>
              </div>

              {/* Opción 2: Completo (Migración) */}
              <div
                onClick={() => setCreatingType('FULL_SYSTEM')}
                className={`p-4 rounded-[6px] border transition-all cursor-pointer flex items-start gap-3 ${
                  creatingType === 'FULL_SYSTEM'
                    ? 'border-purple-500 bg-purple-500/10 shadow-sm'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <div className="w-9 h-9 rounded-[6px] bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Archive className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)] font-heading">
                      Sistema Completo &amp; Archivos Multimedia
                    </span>
                    <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">{t('backups.fullMigration')}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{t('backups.fullMigrationDesc')}</p>
                  <ul className="text-[10.5px] text-[var(--text-muted)] space-y-0.5 font-mono">
                    <li>{t('backups.bulletFullPostgres')}</li>
                    <li>• Biblioteca multimedia `/uploads` (portadas WebP, avatares)</li>
                    <li>{t('backups.bulletFullRestore')}</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="px-4 py-2 rounded-[6px] text-xs font-semibold border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >{t('common.cancel')}</button>
              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={creating}
                className="px-4 py-2 rounded-[6px] text-xs font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-md shadow-[var(--accent-primary)]/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{t('backups.generateBackup')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CONFIRMAR RESTAURACIÓN                             */}
      {/* ========================================================= */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            {...propsRestaurar}
            className="w-full max-w-md p-6 rounded-[6px] border border-amber-500/40 bg-[var(--bg-surface-elevated)] backdrop-blur-2xl shadow-2xl space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)]">
              <div className="w-10 h-10 rounded-[6px] bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading text-[var(--text-primary)]">{t('backups.confirmRestoreTitle')}</h3>
                <p className="text-xs text-[var(--text-muted)]">{t('backups.confirmRestoreDesc')}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-[6px] border border-amber-500/20 bg-amber-500/5 space-y-2">
              <div className="text-xs font-mono font-bold text-amber-300">
                Archivo: {restoreTarget.filename}
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('backups.confirmRestoreDetail')}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                disabled={restoring}
                className="px-4 py-2 rounded-[6px] text-xs font-semibold border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >{t('common.cancel')}</button>
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoring}
                className="px-4 py-2 rounded-[6px] text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {restoring ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>{t('backups.confirmRestore')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SUBIR Y RESTAURAR ARCHIVO EXTERNO                 */}
      {/* ========================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            {...propsSubir}
            className="w-full max-w-md p-6 rounded-[6px] border border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] backdrop-blur-2xl shadow-2xl space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)]">
              <div className="w-9 h-9 rounded-[6px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading text-[var(--text-primary)]">
                  Subir &amp; Restaurar Copia Externa
                </h3>
                <p className="text-xs text-[var(--text-muted)]">{t('backups.uploadBackupFile')}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded-[6px] p-6 text-center space-y-2 cursor-pointer transition-colors bg-[var(--bg-surface)]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".psbackup,.json,.gz"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center mx-auto text-[var(--text-secondary)]">
                  <FileText className="w-5 h-5" />
                </div>

                <div className="text-xs font-bold text-[var(--text-primary)]">
                  {uploadFile ? uploadFile.name : t('backups.clickToSelectFile')}
                </div>

                <p className="text-[11px] text-[var(--text-muted)]">{t('backups.supportedFormats')}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                }}
                disabled={uploading}
                className="px-4 py-2 rounded-[6px] text-xs font-semibold border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >{t('common.cancel')}</button>
              <button
                type="button"
                onClick={handleUploadAndRestore}
                disabled={uploading || !uploadFile}
                className="px-4 py-2 rounded-[6px] text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>{t('backups.uploadAndRestore')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CONFIRMAR ELIMINACIÓN                              */}
      {/* ========================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            {...propsBorrar}
            className="w-full max-w-sm p-6 rounded-[6px] border border-red-500/30 bg-[var(--bg-surface-elevated)] backdrop-blur-2xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)]">
              <div className="w-9 h-9 rounded-[6px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading text-[var(--text-primary)]">{t('backups.confirmDeleteTitle')}</h3>
                <p className="text-xs text-[var(--text-muted)]">{t('backups.cannotBeUndone')}</p>
              </div>
            </div>

            <div className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-surface)] p-3 rounded-[6px] border border-[var(--border-subtle)] truncate">
              {deleteTarget.filename}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-[6px] text-xs font-semibold border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >{t('common.cancel')}</button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-[6px] text-xs font-bold bg-red-500 text-white hover:bg-red-600 shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{t('backups.deleteBackup')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
