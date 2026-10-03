'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { useModalA11y } from '@/components/useModalA11y';
import { ConfirmModal } from '@/components/ConfirmModal';
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

  // Dialog semantics and focus management for modals in this view.
  const { dialogProps: createProps } = useModalA11y(Boolean(showCreateModal), () => setShowCreateModal(false));
  const { dialogProps: restoreProps } = useModalA11y(Boolean(restoreTarget), () => setRestoreTarget(null));
  const { dialogProps: uploadProps } = useModalA11y(Boolean(showUploadModal), () => setShowUploadModal(false));
  const { dialogProps: deleteProps } = useModalA11y(Boolean(deleteTarget), () => setDeleteTarget(null));

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
      showToast(t('backups.backupGeneratedSuccess', { filename: res.filename }), 'success');
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

  // File is fetched entirely before offering: on large backups seconds pass
  // without signal, so button spins meanwhile.
  const [downloading, setDownloading] = useState<string | null>(null);
  // Downloading or restoring a backup asks for the password again (like system
  // credentials): a backup holds every account, a stolen session must not be enough.
  const [downloadTarget, setDownloadTarget] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const passwordField = (
    <input
      type="password"
      autoComplete="current-password"
      suppressHydrationWarning
      value={adminPassword}
      onChange={(e) => setAdminPassword(e.target.value)}
      placeholder={t('credentials.yourPassword')}
      aria-label={t('credentials.yourPassword')}
      className="glass-input text-xs w-full"
    />
  );
  const handleDownload = (filename: string) => {
    if (!downloading) setDownloadTarget(filename);
  };
  const confirmDownload = () => {
    const filename = downloadTarget;
    if (!filename || downloading) return;
    setDownloading(filename);
    api.admin
      .downloadBackup(filename, adminPassword)
      .then((blob) => {
        setDownloadTarget(null);
        setAdminPassword('');
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
      .finally(() => setDownloading(null));
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      setRestoring(true);
      const res = await api.admin.restoreBackup(restoreTarget.filename, adminPassword);
      showToast(t('backups.restoreSuccessRecords', { count: res.restoredRecords }), 'success');
      setRestoreTarget(null);
      setAdminPassword('');
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
      const res = await api.admin.uploadAndRestoreBackup(uploadFile, adminPassword);
      showToast(t('backups.uploadRestoreSuccessRecords', { count: res.restoredRecords }), 'success');
      setShowUploadModal(false);
      setAdminPassword('');
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
    const backup = deleteTarget;
    setDeleteTarget(null);
    setBackups((prev) => prev.filter((b) => b.filename !== backup.filename));
    showUndoToast(t('common.deletingItem', { name: backup.filename }), {
      onUndo: () => loadBackupsData(),
      onExpire: async () => {
        try {
          await api.admin.deleteBackup(backup.filename);
          showToast(t('backups.backupDeleted', { name: backup.filename }), 'info');
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

          {/* MIGRATION GUIDE BANNER */}
          <AdminBackupsMigrationBanner />

          {/* STATS OVERVIEW CARDS */}
          <AdminBackupsStats
            totalBackups={totalBackups}
            storageUsed={storageUsed}
            schedule={schedule}
          />

          {/* TWO-COLUMN GRID: CRON CONFIGURATION + BACKUPS LIST */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* COLUMN 1: SCHEDULE CONFIGURATION */}
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
              downloading={downloading}
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
          createProps={createProps}
          setShowCreateModal={setShowCreateModal}
          creatingType={creatingType}
          setCreatingType={setCreatingType}
          creating={creating}
          handleCreateBackup={handleCreateBackup}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: CONFIRM RESTORE                                    */}
      {/* ========================================================= */}
      {restoreTarget && (
        <AdminBackupRestoreModal
          restoreProps={restoreProps}
          setRestoreTarget={(value) => {
            setRestoreTarget(value);
            if (!value) setAdminPassword('');
          }}
          restoreTarget={restoreTarget}
          restoring={restoring}
          handleRestore={handleRestore}
          passwordField={passwordField}
          passwordReady={adminPassword.length > 0}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: UPLOAD AND RESTORE EXTERNAL FILE                   */}
      {/* ========================================================= */}
      {showUploadModal && (
        <AdminBackupUploadModal
          uploadProps={uploadProps}
          setShowUploadModal={(value) => {
            setShowUploadModal(value);
            if (!value) setAdminPassword('');
          }}
          setUploadFile={setUploadFile}
          uploadFile={uploadFile}
          fileInputRef={fileInputRef}
          uploading={uploading}
          handleUploadAndRestore={handleUploadAndRestore}
          passwordField={passwordField}
          passwordReady={adminPassword.length > 0}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(downloadTarget)}
        title={t('backups.downloadBackup')}
        description={t('backups.passwordToDownload')}
        confirmText={t('backups.downloadBackup')}
        cancelText={t('common.cancel')}
        variant="warning"
        loading={Boolean(downloading)}
        onConfirm={confirmDownload}
        onClose={() => {
          setDownloadTarget(null);
          setAdminPassword('');
        }}
      >
        {passwordField}
      </ConfirmModal>

      {/* ========================================================= */}
      {/* MODAL: CONFIRM DELETION                                   */}
      {/* ========================================================= */}
      {deleteTarget && (
        <AdminBackupDeleteModal
          deleteProps={deleteProps}
          setDeleteTarget={setDeleteTarget}
          deleteTarget={deleteTarget}
          handleDelete={handleDelete}
        />
      )}
    </div>
  );
}
