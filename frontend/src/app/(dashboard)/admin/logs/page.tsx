'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Activity,
  Terminal,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CustomSelect } from '@/components/CustomSelect';

export default function AdminLogsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtros de Logs
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [logSearch, setLogSearch] = useState('');

  // Form de dominios
  const [newDomain, setNewDomain] = useState('');
  const [isAllowedDomain, setIsAllowedDomain] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const meRes = await api.auth.me().catch(() => null);
      const meUser = meRes?.user || meRes;
      if (!meUser || meUser.role !== 'ADMIN') {
        showToast(t('admin.adminRequired'), 'error');
        router.push('/catalog');
        return;
      }

      const [dashRes, healthRes] = await Promise.allSettled([
        api.admin.getDashboard(),
        api.admin.getSystemHealth(),
      ]);

      if (dashRes.status === 'fulfilled') setData(dashRes.value);
      if (healthRes.status === 'fulfilled') setSystemHealth(healthRes.value);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    showToast(t('admin.refreshingLogs'), 'info');
    await loadData();
    setIsRefreshing(false);
    showToast(t('admin.logsUpdated'), 'success');
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    try {
      await api.admin.addDomain(newDomain.trim(), isAllowedDomain);
      showToast(`Dominio "${newDomain}" agregado a las políticas.`, 'success');
      setNewDomain('');
      loadData();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleDeleteDomain = async (id: string) => {
    try {
      await api.admin.deleteDomain(id);
      showToast(t('admin.domainRemoved'), 'info');
      loadData();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const domainPolicies = data?.domainPolicies || [];
  const systemLogs = data?.systemLogs || [];

  const filteredLogs = systemLogs.filter((log: any) => {
    const matchesLevel = logFilter === 'ALL' || log.level === logFilter;
    const matchesSearch =
      !logSearch ||
      log.message.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.service.toLowerCase().includes(logSearch.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.logsTitle')} />

      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">Salud &amp; Logs del Sistema</h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{t('admin.logsSubtitle')}</p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
                className="btn-secondary"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refrescar Logs</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-8 min-w-0">
        {/* SECCIÓN POLÍTICAS DE DOMINIO DE CORREO */}
        <div className="glass-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--glass-border)] pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-text)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.domainPolicies')}</h2>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('admin.domainPoliciesDesc')}</p>
            </div>

            {/* Form para agregar nuevo dominio en línea compacta */}
            <form onSubmit={handleAddDomain} className="flex items-center gap-2 shrink-0 flex-nowrap">
              <input
                type="text"
                required
                suppressHydrationWarning
                autoComplete="off"
                placeholder="ej: tempmail.com"
                      aria-label="Dominio a bloquear"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="w-36 sm:w-48 h-[36px] min-h-[36px] px-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] outline-none transition-all"
              />
              <div className="w-28 shrink-0">
                <CustomSelect
                  value={isAllowedDomain ? 'ALLOW' : 'BLOCK'}
                  onChange={(val) => setIsAllowedDomain(val === 'ALLOW')}
                  accentColor="sky"
                  options={[
                    { value: 'ALLOW', label: 'Permitir' },
                    { value: 'BLOCK', label: 'Bloquear' },
                  ]}
                />
              </div>
              <button
                type="submit"
                className="btn-primary h-[36px] min-h-[36px] px-3.5 text-xs flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </form>
          </div>

          {/* Lista de dominios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="skeleton w-4 h-4 rounded-full shrink-0" />
                    <div className="skeleton h-3 w-32 rounded" />
                  </div>
                  <div className="skeleton h-7 w-20 rounded-[4px]" />
                </div>
              ))
            ) : domainPolicies.length === 0 ? (
              <div className="col-span-full py-4 text-center text-xs font-mono text-[var(--text-muted)]">{t('admin.noDomainPolicies')}</div>
            ) : (
              domainPolicies.map((dp: any) => (
                <div
                  key={dp.id}
                  className="flex items-center justify-between p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {dp.isAllowed ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="text-xs font-mono text-[var(--text-primary)] truncate">{dp.domain}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={
                        dp.isAllowed
                          ? 'h-7 px-2.5 rounded-[4px] text-[10.5px] font-mono font-semibold inline-flex items-center justify-center bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 select-none'
                          : 'h-7 px-2.5 rounded-[4px] text-[10.5px] font-mono font-semibold inline-flex items-center justify-center bg-rose-500/15 text-rose-400 border border-rose-500/30 select-none'
                      }
                    >
                      {dp.isAllowed ? 'PERMITIDO' : 'BLOQUEADO'}
                    </span>
                    <button
                      onClick={() => handleDeleteDomain(dp.id)}
                      className="btn-danger btn-icon-sm"
                      title="Eliminar dominio"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECCIÓN TERMINAL DE LOGS EN VIVO */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-[var(--accent-text)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.eventConsole')}</h3>
            </div>

            {/* Filtros de Logs */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  suppressHydrationWarning
                  autoComplete="off"
                  placeholder="Filtrar mensajes..."
                      aria-label={t('admin.filterLogMessages')}
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="glass-input glass-input-icon text-xs font-mono"
                />
              </div>

              <div className="flex items-center bg-[var(--bg-surface)] p-1 rounded-[6px] border border-[var(--border-subtle)]">
                {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLogFilter(lvl)}
                    className={`px-2.5 py-1 rounded-[4px] text-[10.5px] font-mono font-bold transition-colors cursor-pointer border ${
                      logFilter === lvl
                        ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/30 dark:bg-[#FF634A]/20 dark:text-[#ff7d69] dark:border-[#FF634A]/40 shadow-xs'
                        : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Consola Terminal */}
          <div className="rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-2 scrollbar-thin">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-3 w-16 rounded" />
                  <div className="skeleton h-3 w-12 rounded" />
                  <div className="skeleton h-3 w-20 rounded" />
                  <div className="skeleton h-3 flex-1 rounded" />
                </div>
              ))
            ) : filteredLogs.length === 0 ? (
              <div className="py-8 text-center text-[var(--text-muted)]">
                &gt; No hay eventos registrados que coincidan con los filtros.
              </div>
            ) : (
              filteredLogs.map((log: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-[var(--text-muted)] shrink-0 select-none">[{log.timestamp || 'AHORA'}]</span>
                  <span
                    className={`px-1.5 rounded-[4px] text-[10px] font-bold shrink-0 ${
                      log.level === 'ERROR'
                        ? 'bg-rose-500/20 text-rose-400'
                        : log.level === 'WARN'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-sky-500/20 text-sky-400'
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="text-purple-400 shrink-0">[{log.service || 'CORE'}]</span>
                  <span className="text-[var(--text-primary)] break-words flex-1">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
