'use client';

import {
  Eye,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { AnnouncementBanner, AnnouncementData } from '@/components/AnnouncementBanner';

interface AnnouncementPreviewProps {
  t: (key: string, values?: any) => string;
  previewMode: 'desktop' | 'mobile';
  setPreviewMode: (mode: 'desktop' | 'mobile') => void;
  formData: AnnouncementData;
}

export function AnnouncementPreview({
  t,
  previewMode,
  setPreviewMode,
  formData,
}: AnnouncementPreviewProps) {
  return (
    <>
        {/* LIVE PREVIEW BOX */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.livePreview')}</span>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className={`p-1.5 rounded-[4px] transition-colors cursor-pointer ${
                  previewMode === 'desktop'
                    ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
                title="Vista Escritorio"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={`p-1.5 rounded-[4px] transition-colors cursor-pointer ${
                  previewMode === 'mobile'
                    ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
                title={t('announcements.mobileView')}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            className={`transition-all duration-300 mx-auto rounded-[8px] overflow-hidden border border-[var(--border-subtle)] shadow-md ${
              previewMode === 'mobile' ? 'max-w-md' : 'w-full'
            }`}
          >
            <AnnouncementBanner
              previewData={formData}
              isPreview
              isMobilePreview={previewMode === 'mobile'}
            />
          </div>
        </section>
    </>
  );
}
