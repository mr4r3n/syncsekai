'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { useModalA11y } from '@/components/useModalA11y';
import { AdminBackupsPageHeader } from './_components/AdminBackupsPageHeader';
import { AdminBackupsMigrationBanner } from './_components/AdminBackupsMigrationBanner';
import { AdminBackupsStats } from './_components/AdminBackupsStats';
import { AdminBackupsScheduleCard } from './_components/AdminBackupsScheduleCard';
import { AdminBackupsTable } from './_components/AdminBackupsTable';
import { AdminBackupCreateModal } from './_components/AdminBackupCreateModal';
import { AdminBackupRestoreModal } from './_components/AdminBackupRestoreModal';
import { AdminBackupUploadModal } from './_components/AdminBackupUploadModal';
import { AdminBackupDeleteModal } from './_components/AdminBackupDeleteModal';

export default function AdminBackupsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast, showUndoToast } = useToast();
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

  // El fichero se trae entero antes de ofrecerlo: en uno grande pasan segundos
  // sin señal, así que el botón gira mientras tanto.
  const [descargando, setDescargando] = useState<string | null>(null);
  const handleDownload = (filename: string) => {
    if (descargando) return;
    setDescargando(filename);
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
        showToast(t('backups.downloading', { filename }), 'info');
      })
      .catch((err) => {
        showToast(`${t('backups.downloadError')} ` + err.message, 'error');
      })
      .finally(() => setDescargando(null));
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

  const handleDelete = () => {
    if (!deleteTarget) return;
    const copia = deleteTarget;
    setDeleteTarget(null);
    setBackups((prev) => prev.filter((b) => b.filename !== copia.filename));
    showUndoToast(t('common.deletingItem', { name: copia.filename }), {
      alDeshacer: () => loadBackupsData(),
      alExpirar: async () => {
        try {
          await api.admin.deleteBackup(copia.filename);
          showToast(t('backups.backupDeleted', { name: copia.filename }), 'info');
        } catch (err: any) {
          showToast(`${t('backups.deleteBackupError')} ` + err.message, 'error');
        }
        loadBackupsData();
      },
    });
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
          <AdminBackupsPageHeader
            setIsRefreshing={setIsRefreshing}
            loadBackupsData={loadBackupsData}
            isRefreshing={isRefreshing}
            loading={loading}
            setShowUploadModal={setShowUploadModal}
            setCreatingType={setCreatingType}
            setShowCreateModal={setShowCreateModal}
          />

          {/* BANNER GUÍA DE MIGRACIÓN */}
          <AdminBackupsMigrationBanner />

          {/* STATS OVERVIEW CARDS */}
          <AdminBackupsStats
            totalBackups={totalBackups}
            storageUsed={storageUsed}
            schedule={schedule}
          />

          {/* GRID DE DOS COLUMNAS: CONFIGURACIÓN CRON + LISTA DE BACKUPS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* COLUMNA 1: CONFIGURACIÓN DE PROGRAMACIÓN */}
            <AdminBackupsScheduleCard
              handleSaveSchedule={handleSaveSchedule}
              schedule={schedule}
              setSchedule={setSchedule}
              savingSchedule={savingSchedule}
              formatDateTime={formatDateTime}
            />

            {/* COLUMNA 2: LISTA DE COPIAS DE SEGURIDAD */}
            <AdminBackupsTable
              backupFilter={backupFilter}
              setBackupFilter={setBackupFilter}
              backups={backups}
              loading={loading}
              setShowCreateModal={setShowCreateModal}
              formatDateTime={formatDateTime}
              handleDownload={handleDownload}
              descargando={descargando}
              setRestoreTarget={setRestoreTarget}
              setDeleteTarget={setDeleteTarget}
            />
          </div>
        </main>

      {/* ========================================================= */}
      {/* MODAL: CREAR COPIA DE SEGURIDAD                           */}
      {/* ========================================================= */}
      {showCreateModal && (
        <AdminBackupCreateModal
          propsCrear={propsCrear}
          setShowCreateModal={setShowCreateModal}
          creatingType={creatingType}
          setCreatingType={setCreatingType}
          creating={creating}
          handleCreateBackup={handleCreateBackup}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: CONFIRMAR RESTAURACIÓN                             */}
      {/* ========================================================= */}
      {restoreTarget && (
        <AdminBackupRestoreModal
          propsRestaurar={propsRestaurar}
          setRestoreTarget={setRestoreTarget}
          restoreTarget={restoreTarget}
          restoring={restoring}
          handleRestore={handleRestore}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: SUBIR Y RESTAURAR ARCHIVO EXTERNO                 */}
      {/* ========================================================= */}
      {showUploadModal && (
        <AdminBackupUploadModal
          propsSubir={propsSubir}
          setShowUploadModal={setShowUploadModal}
          setUploadFile={setUploadFile}
          uploadFile={uploadFile}
          fileInputRef={fileInputRef}
          uploading={uploading}
          handleUploadAndRestore={handleUploadAndRestore}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: CONFIRMAR ELIMINACIÓN                              */}
      {/* ========================================================= */}
      {deleteTarget && (
        <AdminBackupDeleteModal
          propsBorrar={propsBorrar}
          setDeleteTarget={setDeleteTarget}
          deleteTarget={deleteTarget}
          handleDelete={handleDelete}
        />
      )}
    </div>
  );
}
