'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  ShieldBan,
  Trash2,
  Plus,
  Search,
  Check,
  Sparkles,
  AlertTriangle,
  Loader2,
  Tags,
  Info,
  Filter,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';

const AVAILABLE_GENRES = [
  { id: 'Hentai', label: 'Hentai / Adult', isNsfw: true },
  { id: 'Ecchi', label: 'Ecchi', isNsfw: true },
  { id: 'Erotica', label: 'Erotica', isNsfw: true },
  { id: 'Horror', label: 'Horror' },
  { id: 'Shoujo Ai', label: 'Shoujo Ai / GL' },
  { id: 'Shounen Ai', label: 'Shounen Ai / BL' },
  { id: 'Mecha', label: 'Mecha' },
  { id: 'Music', label: 'Music' },
  { id: 'Sports', label: 'Sports' },
  { id: 'Psychological', label: 'Psychological' },
  { id: 'Romance', label: 'Romance' },
  { id: 'Slice of Life', label: 'Slice of Life' },
  { id: 'Supernatural', label: 'Supernatural' },
  { id: 'Fantasy', label: 'Fantasy' },
  { id: 'Action', label: 'Action' },
  { id: 'Comedy', label: 'Comedy' },
  { id: 'Drama', label: 'Drama' },
  { id: 'Sci-Fi', label: 'Sci-Fi' },
];

export default function BlacklistPage() {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [blockedGenres, setBlockedGenres] = useState<string[]>([]);
  const [savingGenres, setSavingGenres] = useState(false);

  // Formulario manual
  const [inputTitle, setInputTitle] = useState('');
  const [reason, setReason] = useState(t('blacklist.accountPrivacy'));
  const [addingTitle, setAddingTitle] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [blRes, genresRes] = await Promise.allSettled([
        api.blacklist.get(),
        api.blacklist.getBlockedGenres(),
      ]);

      if (blRes.status === 'fulfilled' && Array.isArray(blRes.value)) {
        setBlacklist(blRes.value);
      } else {
        setBlacklist([]);
      }

      if (genresRes.status === 'fulfilled' && genresRes.value?.blockedGenres) {
        setBlockedGenres(genresRes.value.blockedGenres);
      }
    } catch (e: any) {
      showToast(t('blacklist.loadExclusionError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTitle.trim()) {
      showToast(t('blacklist.enterTitleOrPattern'), 'error');
      return;
    }

    try {
      setAddingTitle(true);
      await api.blacklist.add(inputTitle.trim(), reason);
      showToast(t('blacklist.addedToast', { title: inputTitle.trim() }), 'success');
      setInputTitle('');
      // Recargar
      const res = await api.blacklist.get();
      setBlacklist(res);
    } catch (err: any) {
      showToast(err.message || t('blacklist.addTitleError'), 'error');
    } finally {
      setAddingTitle(false);
    }
  };

  const handleRemoveTitle = async (id: string, title: string) => {
    try {
      await api.blacklist.remove(id);
      setBlacklist((prev) => prev.filter((item) => item.id !== id));
      showToast(`"${title}" desbloqueado correctamente.`, 'info');
    } catch (e: any) {
      showToast(t('blacklist.unblockError'), 'error');
    }
  };

  const toggleGenre = (genreId: string) => {
    setBlockedGenres((prev) =>
      prev.includes(genreId) ? prev.filter((g) => g !== genreId) : [...prev, genreId]
    );
  };

  const handleSaveGenres = async () => {
    try {
      setSavingGenres(true);
      await api.blacklist.updateBlockedGenres(blockedGenres);
      showToast(t('blacklist.genreFilterUpdated'), 'success');
    } catch (e: any) {
      showToast(t('blacklist.saveGenresError'), 'error');
    } finally {
      setSavingGenres(false);
    }
  };

  const handleBlockNsfw = () => {
    const nsfwIds = ['Hentai', 'Ecchi', 'Erotica'];
    const merged = Array.from(new Set([...blockedGenres, ...nsfwIds]));
    setBlockedGenres(merged);
    showToast(t('blacklist.adultGenresSelected'), 'info');
  };

  const handleClearGenres = () => {
    setBlockedGenres([]);
    showToast(t('blacklist.genreFiltersCleared'), 'info');
  };

  const filteredBlacklist = blacklist.filter((item) =>
    item.titlePattern?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.reason?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.userLibrary')} currentLabel={t('blacklist.title')} />

      {/* HEADER DE LA SECCIÓN (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-2">
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
                {t('blacklist.title')}
              </h1>
              <span className="badge-status-danger">
                {t('blacklist.countBadge', { titles: blacklist.length, genres: blockedGenres.length })}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {t('blacklist.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleBlockNsfw}
              className="btn-danger"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('blacklist.quickNsfw')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL EN DOS COLUMNAS BALANCEADAS */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-8 min-w-0">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-text)]" />
            <span className="text-xs font-mono text-[var(--text-muted)]">{t('blacklist.loadingExclusions')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUMNA IZQUIERDA: BLOQUEO MANUAL & TABLA (7 COLS) */}
            <div className="lg:col-span-7 space-y-6">
              {/* FORMULARIO DE BLOQUEO MANUAL */}
              <div className="glass-card p-6 sm:p-7 space-y-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[6px] bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center font-bold">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('blacklist.blockTitleManual')}</h2>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {t('blacklist.blockTitleSubtitle')}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAddTitle} className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('blacklist.showOrFolder')}</label>
                    <input
                      type="text"
                      suppressHydrationWarning
                      autoComplete="off"
                      value={inputTitle}
                      onChange={(e) => setInputTitle(e.target.value)}
                      placeholder={t('blacklist.addTitlePlaceholder')}
                      aria-label={t('blacklist.addTitleLabel')}
                      className="glass-input"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('blacklist.exclusionReason')}</label>
                      <CustomSelect
                        value={reason}
                        onChange={setReason}
                        accentColor="rose"
                        options={[
                          { value: t('blacklist.accountPrivacy'), label: t('blacklist.accountPrivacy') },
                          { value: t('blacklist.reasonNsfw'), label: t('blacklist.reasonNsfw') },
                          { value: t('blacklist.reasonFiller'), label: t('blacklist.reasonFiller') },
                          { value: t('blacklist.reasonDuplicate'), label: t('blacklist.reasonDuplicate') },
                          { value: t('blacklist.reasonManual'), label: t('blacklist.reasonManual') },
                        ]}
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={addingTitle || !inputTitle.trim()}
                        className="btn-danger w-full py-2.5"
                      >
                        {addingTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        <span>{t('blacklist.blockTitleButton')}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* LISTA / TABLA DE TÍTULOS PROHIBIDOS */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--glass-border)]">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('blacklist.blacklistedTitles')}</h3>
                    <span className="badge-status-danger">
                      {filteredBlacklist.length}
                    </span>
                  </div>

                  {blacklist.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] w-full sm:w-60">
                      <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      <input
                        type="text"
                        placeholder={t('blacklist.searchListPlaceholder')}
                      aria-label={t('blacklist.searchListLabel')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent text-xs text-[var(--text-primary)] outline-none"
                      />
                    </div>
                  )}
                </div>

                {blacklist.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-12 h-12 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)]">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('blacklist.noBlockedTitles')}</p>
                      <p className="text-xs text-[var(--text-secondary)] max-w-sm">{t('blacklist.noBlockedDesc')}</p>
                    </div>
                  </div>
                ) : filteredBlacklist.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)] font-mono">
                    No se encontraron coincidencias para &quot;{searchQuery}&quot;
                  </div>
                ) : (
                    <div className="space-y-2.5">
                      {filteredBlacklist.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 sm:p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all flex items-center justify-between gap-3 group"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="text-xs font-bold text-[var(--text-primary)] truncate flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                              <span className="truncate">{item.titlePattern}</span>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 text-[10.5px] sm:text-[11px] text-[var(--text-secondary)] font-mono flex-wrap">
                              <span className="badge-pill max-w-[200px] sm:max-w-none">
                                <span className="truncate">{item.reason}</span>
                              </span>
                              <span className="text-[var(--text-muted)]">•</span>
                              <span className="text-[var(--text-muted)] shrink-0">
                                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Reciente'}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRemoveTitle(item.id, item.titlePattern)}
                            className="btn-danger btn-icon-sm shrink-0"
                            title={t('blacklist.unblockTitle')}
                            aria-label={t('blacklist.unblockTitle')}
                          >
                            <Trash2 className="w-4 h-4 text-rose-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                )}
              </div>
            </div>

            {/* COLUMNA DERECHA: EXCLUSIÓN POR GÉNEROS (5 COLS) */}
            <div className="lg:col-span-5 space-y-6">
              {/* CARD: SELECTOR DE GÉNEROS EXCLUIDOS */}
              <div className="glass-card p-6 sm:p-7 space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--glass-border)]">
                  <div className="flex items-center gap-2.5">
                    <Tags className="w-4 h-4 text-amber-400" />
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('blacklist.genreExclusion')}</h2>
                  </div>
                  <span className="badge-status-warning">
                    {t('blacklist.selectedCount', { n: blockedGenres.length })}
                  </span>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('blacklist.genreExclusionDesc')}</p>

                {/* Acciones Rápidas */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={handleBlockNsfw}
                    className="btn-danger"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t('blacklist.blockNsfw')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearGenres}
                    className="btn-secondary"
                  >
                    {t('blacklist.clearFilters')}
                  </button>
                </div>

                {/* CHIPS DE GÉNEROS INTERACTIVOS */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {AVAILABLE_GENRES.map((genre) => {
                    const isSelected = blockedGenres.includes(genre.id);
                    return (
                      <button
                        key={genre.id}
                        type="button"
                        onClick={() => toggleGenre(genre.id)}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm font-bold'
                            : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-rose-400" />}
                        <span>{genre.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-[var(--glass-border)]">
                  <button
                    type="button"
                    onClick={handleSaveGenres}
                    disabled={savingGenres}
                    className="btn-primary w-full py-2.5"
                  >
                    {savingGenres ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{t('blacklist.saveExcludedGenres')}</span>
                  </button>
                </div>
              </div>

              {/* CARD INFORMATIVO: POLÍTICA DE PRIVACIDAD */}
              <div className="glass-card p-6 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                  <Info className="w-4 h-4 text-sky-400" />
                  <span>{t('blacklist.howSilentTitle')}</span>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('blacklist.howSilentDesc')}{' '}<strong>{t('blacklist.silentlyDiscarded')}</strong>{' '}{t('blacklist.withoutUpdating')}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
