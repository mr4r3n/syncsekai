import React from 'react';
import { Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export function AdminBackupsMigrationBanner() {
  const { t } = useI18n();

  return (
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
  );
}
