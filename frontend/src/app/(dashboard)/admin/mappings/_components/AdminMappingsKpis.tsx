import React from 'react';
import { Layers, Globe, Users, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminMappingsKpisProps {
  totalCount: number;
  globalCount: number;
  userSpecificCount: number;
  pendingCount: number;
}

export function AdminMappingsKpis({
  totalCount,
  globalCount,
  userSpecificCount,
  pendingCount,
}: AdminMappingsKpisProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="glass-card p-5 space-y-1">
        <div className="flex items-center justify-between text-[var(--text-secondary)]">
          <span className="text-xs font-mono font-semibold">Total Registrados</span>
          <Layers className="w-4 h-4 text-sky-400" />
        </div>
        <p className="text-2xl font-bold text-[var(--text-primary)] font-heading">{totalCount}</p>
      </div>

      <div className="glass-card p-5 space-y-1">
        <div className="flex items-center justify-between text-amber-400">
          <span className="text-xs font-mono font-semibold">Globales Oficiales</span>
          <Globe className="w-4 h-4 text-amber-400" />
        </div>
        <p className="text-2xl font-bold text-amber-400 font-heading">{globalCount}</p>
      </div>

      <div className="glass-card p-5 space-y-1">
        <div className="flex items-center justify-between text-[var(--text-secondary)]">
          <span className="text-xs font-mono font-semibold">{t('admin.userMappings')}</span>
          <Users className="w-4 h-4 text-zinc-400" />
        </div>
        <p className="text-2xl font-bold text-[var(--text-primary)] font-heading">{userSpecificCount}</p>
      </div>

      <div className="glass-card p-5 space-y-1">
        <div className="flex items-center justify-between text-rose-400">
          <span className="text-xs font-mono font-semibold">{t('admin.pendingConflicts')}</span>
          <AlertTriangle className="w-4 h-4 text-rose-400" />
        </div>
        <p className="text-2xl font-bold text-rose-400 font-heading">{pendingCount}</p>
      </div>
    </div>
  );
}
