'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { useRouter } from 'next/navigation';
import { useModalA11y } from '@/components/useModalA11y';
import { AdminServicesPageHeader } from './_components/AdminServicesPageHeader';
import { AdminServicesStatusCards } from './_components/AdminServicesStatusCards';
import { AdminServicesApisCard } from './_components/AdminServicesApisCard';
import { AdminServicesSystemCard } from './_components/AdminServicesSystemCard';
import { AdminServicesDistributionSection } from './_components/AdminServicesDistributionSection';
import { AdminServicesMaintenanceModal } from './_components/AdminServicesMaintenanceModal';

export default function AdminServicesPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string; estimatedEnd: string | null }>({
    enabled: false,
    message: '',
    estimatedEnd: null,
  });
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [mEnabled, setMEnabled] = useState(false);
  const [mMessage, setMMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10); // 10s by default
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Dialog semantics and focus management for modals in this view.
  const { dialogProps: maintenanceProps } = useModalA11y(Boolean(showMaintenanceModal), () => setShowMaintenanceModal(false));

  useEffect(() => {
    loadData(true);
  }, []);

  // Real-time auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      loadData(false);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval]);

  const loadData = async (showInitialLoader = false) => {
    try {
      if (showInitialLoader) setLoading(true);
      const meRes = await api.auth.me().catch(() => null);
      const meUser = meRes?.user || meRes;
      if (!meUser || meUser.role !== 'ADMIN') {
        showToast(t('admin.adminRequired'), 'error');
        router.push('/catalog');
        return;
      }

      const [dashRes, healthRes, maintRes] = await Promise.allSettled([
        api.admin.getDashboard(),
        api.admin.getSystemHealth(),
        api.admin.getMaintenance(),
      ]);

      if (dashRes.status === 'fulfilled') setData(dashRes.value);
      if (healthRes.status === 'fulfilled') setSystemHealth(healthRes.value);
      if (maintRes.status === 'fulfilled') {
        setMaintenance(maintRes.value);
        setMEnabled(maintRes.value.enabled);
        setMMessage(maintRes.value.message);
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      if (showInitialLoader) setLoading(false);
    }
  };

  const handleSaveMaintenance = async () => {
    setSavingMaintenance(true);
    try {
      const updated = await api.admin.setMaintenance({
        enabled: mEnabled,
        message: mMessage,
      });
      setMaintenance(updated);
      setShowMaintenanceModal(false);
      showToast(
        updated.enabled
          ? t('admin.maintenanceOn')
          : t('admin.maintenanceOff'),
        updated.enabled ? 'info' : 'success',
      );
    } catch (err: any) {
      showToast(err.message || t('admin.maintenanceUpdateError'), 'error');
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData(false);
    setIsRefreshing(false);
    showToast(t('admin.servicesUpdated'), 'success');
  };

  const stats = data?.stats || {};
  const serviceDist = data?.serviceDistribution || {};

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.servicesTitle')} />

      {/* TOP HEADER (STATIC ON MOBILE, STICKY ON DESKTOP) */}
      <AdminServicesPageHeader
        autoRefreshInterval={autoRefreshInterval}
        setAutoRefreshInterval={setAutoRefreshInterval}
        showToast={showToast}
        maintenance={maintenance}
        setMEnabled={setMEnabled}
        setMMessage={setMMessage}
        setShowMaintenanceModal={setShowMaintenanceModal}
        handleRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        loading={loading}
        lastUpdated={lastUpdated}
      />

      {/* CONTENIDO PRINCIPAL */}
      <main id="main-content" tabIndex={-1} className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-8 min-w-0 outline-none">
        {/* ROW DE ESTADO DE MICROSERVICIOS PRINCIPALES */}
        <AdminServicesStatusCards
          loading={loading}
          stats={stats}
          serviceDist={serviceDist}
        />

        {/* SECTION 2: EXTERNAL APIS & DATABASE STATUS AND LATENCY */}
        <AdminServicesApisCard
          loading={loading}
          systemHealth={systemHealth}
        />

        {/* SECTION 3: SERVER HARDWARE AND RESOURCES */}
        <AdminServicesSystemCard
          loading={loading}
          systemHealth={systemHealth}
        />

        {/* TRACKER AND LIBRARY DISTRIBUTION */}
        <AdminServicesDistributionSection
          serviceDist={serviceDist}
          stats={stats}
        />
      </main>

      {/* MAINTENANCE MODE MANAGEMENT MODAL */}
      {showMaintenanceModal && (
        <AdminServicesMaintenanceModal
          maintenanceProps={maintenanceProps}
          setShowMaintenanceModal={setShowMaintenanceModal}
          mEnabled={mEnabled}
          setMEnabled={setMEnabled}
          mMessage={mMessage}
          setMMessage={setMMessage}
          handleSaveMaintenance={handleSaveMaintenance}
          savingMaintenance={savingMaintenance}
        />
      )}
    </div>
  );
}
