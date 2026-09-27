'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from './ToastProvider';
import { useModalA11y } from './useModalA11y';
import { X, Play, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface ScrobbleTesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ScrobbleTesterModal({ isOpen, onClose, onSuccess }: ScrobbleTesterModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [showTitle, setShowTitle] = useState('Sousou no Frieren');
  const [episodeNumber, setEpisodeNumber] = useState(28);
  const [viewPercentage, setViewPercentage] = useState(90);
  const [rating, setRating] = useState(10);
  const [source, setSource] = useState<'PLEX' | 'JELLYFIN' | 'EMBY'>('PLEX');
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const sampleShows = [
    { title: 'Sousou no Frieren', ep: 28, score: 10 },
    { title: 'Dungeon Meshi', ep: 18, score: 9 },
    { title: 'Redo of Healer', ep: 5, score: 7, note: t('simulator.inBlacklist') },
    { title: 'Kimetsu no Yaiba: Hashira Geiko', ep: 4, score: 8.5 },
  ];

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await api.connections.simulateScrobble({
        showTitle,
        episodeNumber: Number(episodeNumber),
        viewPercentage: Number(viewPercentage),
        rating: Number(rating),
        source,
        dryRun,
      });
      setResult(res);
      if (res.processed) {
        showToast(res.message, 'success');
        if (!dryRun) onSuccess();
      } else {
        showToast(res.message, 'warning');
      }
    } catch (err: any) {
      showToast(`${t('simulator.simulationError')} ` + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Foco dentro al abrir, Tab acotado al diálogo y foco devuelto al cerrar.
  const { dialogProps } = useModalA11y(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
      <div
        {...dialogProps}
        className="w-full max-w-lg rounded-[var(--radius-lg,10px)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 shadow-[var(--glass-shadow-lg)] space-y-5 text-[var(--text-primary)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-[var(--radius-md,6px)] flex items-center justify-center text-xs font-bold ${source === 'JELLYFIN' ? 'bg-[#00A4DC] text-white' : source === 'EMBY' ? 'bg-[#52B54B] text-white' : 'bg-[var(--brand-plex)] text-black'}`}>
              <Play className="w-3.5 h-3.5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-primary)] font-heading">{t('simulator.title')}</h3>
              <p className="text-[11px] text-[var(--text-muted)]">{t('simulator.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('modalPlexServer.close')}
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md,6px)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Source selection */}
        <div className="space-y-1.5">
          <span className="text-[10.5px] font-bold text-[var(--text-secondary)]">{t('simulator.eventSource')}</span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSource('PLEX')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-[6px] border text-xs font-semibold transition-all cursor-pointer ${
                source === 'PLEX'
                  ? 'border-[#E5A00D] bg-[#E5A00D]/10 text-[#E5A00D]'
                  : 'border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Plex
            </button>
            <button
              type="button"
              onClick={() => setSource('JELLYFIN')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-[6px] border text-xs font-semibold transition-all cursor-pointer ${
                source === 'JELLYFIN'
                  ? 'border-[#00A4DC] bg-[#00A4DC]/10 text-[#00A4DC]'
                  : 'border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Jellyfin
            </button>
            <button
              type="button"
              onClick={() => setSource('EMBY')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-[6px] border text-xs font-semibold transition-all cursor-pointer ${
                source === 'EMBY'
                  ? 'border-[#52B54B] bg-[#52B54B]/10 text-[#52B54B]'
                  : 'border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Emby
            </button>
          </div>
        </div>

        {/* Quick presets */}
        <div className="space-y-1.5">
          <span className="text-[10.5px] font-bold text-[var(--text-secondary)]">{t('simulator.loadQuickExample')}</span>
          <div className="flex flex-wrap gap-1.5">
            {sampleShows.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setShowTitle(s.title);
                  setEpisodeNumber(s.ep);
                  setRating(s.score);
                  setResult(null);
                }}
                className="badge-pill cursor-pointer hover:border-[var(--accent-primary)] transition-colors"
              >
                {s.title} (Ep. {s.ep}) {s.note && <span className="text-rose-400">{s.note}</span>}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSimulate} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label htmlFor="test-show-title" className="font-bold text-[var(--text-primary)]">{t('simulator.showTitle')}</label>
            <input
              id="test-show-title"
              name="showTitle"
              type="text"
              value={showTitle}
              onChange={(e) => setShowTitle(e.target.value)}
              required
              className="glass-input text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="test-episode-number" className="font-bold text-[var(--text-primary)]">
                Episodio #
              </label>
              <input
                id="test-episode-number"
                name="episodeNumber"
                type="number"
                min="1"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(Number(e.target.value))}
                required
                className="glass-input font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="test-view-percentage" className="font-bold text-[var(--text-primary)]">
                % Visto ({viewPercentage}%)
              </label>
              <input
                id="test-view-percentage"
                name="viewPercentage"
                type="number"
                min="1"
                max="100"
                value={viewPercentage}
                onChange={(e) => setViewPercentage(Number(e.target.value))}
                required
                className="glass-input font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="test-rating" className="font-bold text-[var(--text-primary)]">{t('simulator.rating')}</label>
              <input
                id="test-rating"
                name="rating"
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="glass-input font-mono text-xs"
              />
            </div>
          </div>

          {/* Dry-run mode checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer pt-1 select-none">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border-subtle)] text-[var(--accent-primary)] focus:ring-0 cursor-pointer"
            />
            <span className="text-[11.5px] text-[var(--text-secondary)]">
              {t('simulator.dryRunLabel')}
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center text-xs py-2.5"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{loading ? t('simulator.processing') : dryRun ? t('simulator.calculatePreview') : t('simulator.fireWebhook')}</span>
          </button>
        </form>

        {/* Result Inspection Box */}
        {result && (
          <div
            className={`p-3.5 rounded-[6px] border text-xs space-y-2 animate-in fade-in ${
              result.processed
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {result.processed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              )}
              <span className="text-[var(--text-primary)]">
                {result.dryRun ? t('simulator.previewDryRun') : t('simulator.pipelineStatus', { source: result.source || source })}: {result.status}
              </span>
            </div>
            <p className="text-[var(--text-secondary)]">{result.message}</p>
            {result.mapping && (
              <div className="text-[11px] text-[var(--text-muted)] space-y-0.5 pt-1">
                <div>{t('simulator.mappingLabel')} <span className="font-semibold text-[var(--text-primary)]">{result.mapping.title}</span></div>
                {result.willSync && (
                  <div className="flex items-center gap-2 pt-1">
                    <span>{t('simulator.willSyncWith')}</span>
                    {result.willSync.anilist && <span className="badge-pill">AniList</span>}
                    {result.willSync.mal && <span className="badge-pill">MyAnimeList</span>}
                    {result.willSync.kitsu && <span className="badge-pill">Kitsu</span>}
                    {!result.willSync.anilist && !result.willSync.mal && !result.willSync.kitsu && (
                      <span className="text-amber-400">{t('simulator.noTrackerConnected')}</span>
                    )}
                  </div>
                )}
              </div>
            )}
            {result.impactedServices && (
              <div className="flex items-center gap-2 text-[11px] pt-1">
                <span className="text-[var(--text-muted)]">Plataformas sincronizadas:</span>
                {result.impactedServices.map((svc: string, i: number) => (
                  <span
                    key={i}
                    className="badge-pill"
                  >
                    {svc}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
