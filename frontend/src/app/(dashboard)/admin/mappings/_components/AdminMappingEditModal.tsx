import React from 'react';
import { Sparkles, X, Minus, Plus, Search, Loader2, Check } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminMappingEditModalProps {
  setShowModal: (show: boolean) => void;
  propsMapeo: Record<string, any>;
  isNewMapping: boolean;
  plexTitleInput: string;
  setPlexTitleInput: (val: string) => void;
  plexSeasonInput: number;
  setPlexSeasonInput: React.Dispatch<React.SetStateAction<number>>;
  isGlobalInput: boolean;
  setIsGlobalInput: (val: boolean) => void;
  selectedRemoteAnime: any;
  setSelectedRemoteAnime: (anime: any) => void;
  remoteSearchQuery: string;
  setRemoteSearchQuery: (val: string) => void;
  executeRemoteSearch: (query: string, season?: number) => Promise<void> | void;
  isSearchingRemote: boolean;
  remoteResults: any[];
  handleSaveMapping: (e: React.FormEvent) => Promise<void> | void;
}

export function AdminMappingEditModal({
  setShowModal,
  propsMapeo,
  isNewMapping,
  plexTitleInput,
  setPlexTitleInput,
  plexSeasonInput,
  setPlexSeasonInput,
  isGlobalInput,
  setIsGlobalInput,
  selectedRemoteAnime,
  setSelectedRemoteAnime,
  remoteSearchQuery,
  setRemoteSearchQuery,
  executeRemoteSearch,
  isSearchingRemote,
  remoteResults,
  handleSaveMapping,
}: AdminMappingEditModalProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        {...propsMapeo}
        className="w-full max-w-2xl rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 space-y-6 shadow-[var(--glass-shadow-lg)] text-[var(--text-primary)]">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">
              {isNewMapping ? t('admin.createGlobalMapping') : t('admin.editAdminMapping')}
            </h3>
          </div>
          <button
            onClick={() => setShowModal(false)}
            className="p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSaveMapping} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">{t('admin.plexSeriesTitle')}</label>
              <input
                type="text"
                required
                placeholder="Ej. Mushoku Tensei: Isekai Ittara Honki Dasu"
                aria-label={t('admin.animeTitleInPlex')}
                value={plexTitleInput}
                onChange={(e) => setPlexTitleInput(e.target.value)}
                suppressHydrationWarning
                className="glass-input text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Temporada:</label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min="1"
                  required
                  value={plexSeasonInput}
                  onChange={(e) => setPlexSeasonInput(Math.max(1, parseInt(e.target.value) || 1))}
                  suppressHydrationWarning
                  className="glass-input text-xs font-mono font-medium pl-3 pr-16"
                />
                <div className="absolute right-1 flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setPlexSeasonInput((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                    className="w-6 h-6 flex items-center justify-center rounded-[4px] bg-[var(--btn-secondary-bg)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-95 cursor-pointer"
                    title={t('mappings.previousSeason')}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlexSeasonInput((prev) => (Number(prev) || 1) + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded-[4px] bg-[var(--btn-secondary-bg)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-95 cursor-pointer"
                    title={t('mappings.nextSeason')}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <input
              type="checkbox"
              id="isGlobalCheckbox"
              checked={isGlobalInput}
              onChange={(e) => setIsGlobalInput(e.target.checked)}
              className="w-4 h-4 rounded-[4px] accent-amber-500"
            />
            <label htmlFor="isGlobalCheckbox" className="text-xs font-semibold text-[var(--text-primary)] cursor-pointer">{t('admin.enableAsGlobal')}</label>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--glass-border)]">
            <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center justify-between">
              <span>{t('admin.searchSeriesAniList')}</span>
              {selectedRemoteAnime && (
                <span className="text-[11px] font-mono text-emerald-400">
                  Seleccionado: #{selectedRemoteAnime.id}
                </span>
              )}
            </label>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                <input
                  type="text"
                  placeholder={t('admin.searchByTitlePlaceholder')}
                aria-label={t('admin.searchTitleOnAniList')}
                  value={remoteSearchQuery}
                  onChange={(e) => setRemoteSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      executeRemoteSearch(remoteSearchQuery, plexSeasonInput);
                    }
                  }}
                  suppressHydrationWarning
                  className="glass-input glass-input-icon text-xs font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => executeRemoteSearch(remoteSearchQuery, plexSeasonInput)}
                disabled={isSearchingRemote}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                {isSearchingRemote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>{t('admin.searchWord')}</span>
              </button>
            </div>

            {remoteResults.length > 0 && (
              <div className="max-h-56 overflow-y-auto space-y-2 p-2 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] mt-2">
                {remoteResults.map((r) => {
                  const isSelected = selectedRemoteAnime?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRemoteAnime(r)}
                      className={`p-2 rounded-[6px] flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[var(--nav-active-bg)] border border-[var(--nav-active-border)] shadow-sm'
                          : 'hover:bg-[var(--bg-surface-hover)] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {r.coverImage?.large || r.coverImage?.medium ? (
                          <img
                            src={r.coverImage.large || r.coverImage?.medium}
                            alt={r.title?.romaji}
                            className="w-8 h-11 rounded-[4px] object-cover border border-[var(--border-subtle)] shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-11 rounded-[4px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shrink-0 flex items-center justify-center text-[9px] text-[var(--text-muted)]">
                            IMG
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {r.title?.romaji || r.title?.english}
                          </h4>
                          <p className="text-[10.5px] text-[var(--text-muted)] font-mono">
                            ID: #{r.id} • {r.format || 'TV'} • {r.episodes ? `${r.episodes} eps` : 'En emisión'}
                            {r.seasonYear ? ` • ${r.seasonYear}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isSelected ? (
                          <span className="badge-status-success">
                            SELECCIONADO
                          </span>
                        ) : (
                          <span className="badge-pill">
                            Elegir
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--glass-border)]">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn-secondary"
            >{t('common.cancel')}</button>
            <button
              type="submit"
              disabled={!selectedRemoteAnime}
              className="btn-primary"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{t('admin.saveGlobalMapping')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
