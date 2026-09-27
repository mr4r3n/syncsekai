import React from 'react';
import { Sparkles, X, Minus, Plus, Search, Loader2, Check } from 'lucide-react';

interface MappingEditModalProps {
  propsMapeo: any;
  setShowModal: (show: boolean) => void;
  isNewMapping: boolean;
  handleSaveMapping: (e: React.FormEvent) => Promise<void>;
  plexTitleInput: string;
  setPlexTitleInput: (val: string) => void;
  plexSeasonInput: number;
  setPlexSeasonInput: React.Dispatch<React.SetStateAction<number>>;
  remoteSearchQuery: string;
  setRemoteSearchQuery: (val: string) => void;
  executeRemoteSearch: (query: string, season?: number) => Promise<void>;
  isSearchingRemote: boolean;
  selectedRemoteAnime: any;
  setSelectedRemoteAnime: (anime: any) => void;
  remoteResults: any[];
  isSavingModal: boolean;
  t: (key: string, params?: any) => string;
}

export function MappingEditModal({
  propsMapeo,
  setShowModal,
  isNewMapping,
  handleSaveMapping,
  plexTitleInput,
  setPlexTitleInput,
  plexSeasonInput,
  setPlexSeasonInput,
  remoteSearchQuery,
  setRemoteSearchQuery,
  executeRemoteSearch,
  isSearchingRemote,
  selectedRemoteAnime,
  setSelectedRemoteAnime,
  remoteResults,
  isSavingModal,
  t,
}: MappingEditModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div
        {...propsMapeo}
        className="relative w-full max-w-2xl rounded-[10px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-2xl shadow-[var(--glass-shadow-lg)] p-6 space-y-6 text-[var(--text-primary)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">
                {isNewMapping ? 'Crear Mapeo Manual' : t('mappings.editAnimeLink')}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">{t('mappings.modalIntro')}</p>
            </div>
          </div>

          <button
            onClick={() => setShowModal(false)}
            className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSaveMapping} className="space-y-5">
          {/* Título en Plex y Temporada */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('mappings.plexServerTitle')}</label>
              <input
                type="text"
                required
                value={plexTitleInput}
                onChange={(e) => setPlexTitleInput(e.target.value)}
                placeholder="Ej. Frieren: Beyond Journey's End"
                className="glass-input text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Temporada Servidor
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min={1}
                  required
                  value={plexSeasonInput}
                  onChange={(e) => setPlexSeasonInput(Math.max(1, parseInt(e.target.value) || 1))}
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

          {/* Buscador en vivo de AniList */}
          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-between">
              <span>{t('mappings.searchAnimeAniList')}</span>
              {selectedRemoteAnime && (
                <span className="text-emerald-400 font-mono text-[11px] font-bold">
                  ✓ Seleccionado: #{selectedRemoteAnime.id}
                </span>
              )}
            </label>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                <input
                  type="text"
                  value={remoteSearchQuery}
                  onChange={(e) => setRemoteSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), executeRemoteSearch(remoteSearchQuery, plexSeasonInput))}
                  placeholder={t('mappings.searchByNamePlaceholder')}
                  className="glass-input glass-input-icon text-xs w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => executeRemoteSearch(remoteSearchQuery, plexSeasonInput)}
                disabled={isSearchingRemote || !remoteSearchQuery.trim()}
                className="btn-secondary text-xs"
              >
                {isSearchingRemote ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  t('mappings.searchButton')
                )}
              </button>
            </div>

            {/* Resultados de búsqueda */}
            {remoteResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] mt-2">
                {remoteResults.map((anime) => {
                  const isSel = selectedRemoteAnime?.id === anime.id;
                  return (
                    <div
                      key={anime.id}
                      onClick={() => setSelectedRemoteAnime(anime)}
                      className={`p-2 rounded-[4px] flex items-center gap-3 cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-[var(--nav-active-bg)] border border-[var(--nav-active-border)] text-[var(--nav-active-text)]'
                          : 'hover:bg-[var(--bg-surface-hover)]'
                      }`}
                    >
                      <img
                        src={anime.coverImage?.medium || anime.coverImage?.large}
                        alt={anime.title?.romaji || anime.title?.english}
                        className="w-8 h-11 rounded-[4px] object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">
                          {anime.title?.romaji || anime.title?.english || anime.title?.native}
                        </p>
                        <p className="text-[10.5px] text-[var(--text-muted)] font-mono truncate">
                          {anime.format || 'TV'} • {anime.episodes || '?'} eps • {anime.seasonYear || 'N/A'} • #{anime.id}
                        </p>
                      </div>
                      {isSel && (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Acciones del Modal */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn-secondary"
            >{t('common.cancel')}</button>
            <button
              type="submit"
              disabled={isSavingModal || !selectedRemoteAnime}
              className="btn-primary"
            >
              {isSavingModal ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('mappings.saveMapping')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
