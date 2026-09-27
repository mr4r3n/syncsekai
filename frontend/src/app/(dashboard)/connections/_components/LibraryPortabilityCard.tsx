'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  FolderSync,
  FileCode,
  Loader2,
  Download,
  FileText,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';

interface LibraryPortabilityCardProps {
  loadHubData: (silent?: boolean) => Promise<void>;
}

export function LibraryPortabilityCard({ loadHubData }: LibraryPortabilityCardProps) {
  const { showToast } = useToast();
  const { t } = useI18n();

  // Portabilidad de Biblioteca (Exportar & Importar)
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleExport = async (format: 'mal_xml' | 'json' | 'csv') => {
    try {
      setExportLoading(format);
      showToast(t('connections.generatingExport', { format: format.toUpperCase() }), 'info');
      const res = await api.catalog.exportData(format);

      const blob = new Blob([res.content], { type: res.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(t('connections.exportSuccess', { filename: res.filename }), 'success');
    } catch (err: any) {
      showToast(`${t('connections.exportError')} ` + err.message, 'error');
    } finally {
      setExportLoading(null);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportLoading(true);
      showToast(t('connections.processingImport'), 'info');
      const text = await file.text();
      const res = await api.catalog.importData(text);

      showToast(res.message, 'success');
      loadHubData();
    } catch (err: any) {
      showToast(`${t('connections.importLibraryError')} ` + err.message, 'error');
    } finally {
      setImportLoading(false);
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
    }
  };

  return (
    <div className="glass-card card-plana-movil px-0 py-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <FolderSync className="w-4 h-4 text-[var(--accent-text)]" />
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">
            {t('connections.libraryPortability')}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('connections.exportImportDesc')}</p>
        </div>
      </div>

      {/* EXPORT ACTIONS */}
      <div className="space-y-3 pt-1">
        <span className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase font-mono tracking-wider">
          {t('connections.exportWatched')}
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleExport('mal_xml')}
            disabled={!!exportLoading}
            className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[#2e51a2] hover:bg-[var(--bg-surface-hover)] transition-all text-left space-y-1 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[#2e51a2] flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-[#2e51a2]" /> MAL XML
              </span>
              {exportLoading === 'mal_xml' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
              ) : (
                <Download className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
              )}
            </div>
            <p className="text-[10.5px] text-[var(--text-muted)] leading-tight">{t('connections.xmlCompatible')}</p>
          </button>

          <button
            type="button"
            onClick={() => handleExport('json')}
            disabled={!!exportLoading}
            className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-amber-400/50 hover:bg-[var(--bg-surface-hover)] transition-all text-left space-y-1 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-amber-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" /> JSON
              </span>
              {exportLoading === 'json' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
              ) : (
                <Download className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
              )}
            </div>
            <p className="text-[10.5px] text-[var(--text-muted)] leading-tight">{t('connections.jsonCompatible')}</p>
          </button>

          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={!!exportLoading}
            className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-emerald-400/50 hover:bg-[var(--bg-surface-hover)] transition-all text-left space-y-1 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-emerald-400 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> CSV
              </span>
              {exportLoading === 'csv' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
              ) : (
                <Download className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
              )}
            </div>
            <p className="text-[10.5px] text-[var(--text-muted)] leading-tight">{t('connections.csvCompatible')}</p>
          </button>
        </div>
      </div>

      {/* IMPORT ACTIONS */}
      <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
        <span className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase font-mono tracking-wider">
          {t('connections.importHistory')}
        </span>
        
        <input
          ref={importFileRef}
          type="file"
          accept=".xml,.json,.csv,text/xml,application/json,text/csv"
          onChange={handleImportFile}
          className="hidden"
        />

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            disabled={importLoading}
            className="btn-secondary w-full sm:w-auto px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            {importLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>{t('connections.uploadAnimeFile')}</span>
          </button>
          <span className="text-[11px] text-[var(--text-muted)] text-center sm:text-left">{t('connections.acceptsOfficialExports')}</span>
        </div>
      </div>
    </div>
  );
}
