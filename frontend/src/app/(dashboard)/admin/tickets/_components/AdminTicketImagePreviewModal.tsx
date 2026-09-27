import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminTicketImagePreviewModalProps {
  previewImageUrl: string;
  setPreviewImageUrl: (url: string | null) => void;
}

export function AdminTicketImagePreviewModal({
  previewImageUrl,
  setPreviewImageUrl,
}: AdminTicketImagePreviewModalProps) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => setPreviewImageUrl(null)}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] flex flex-col items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-end gap-2 pb-1">
          <a
            href={previewImageUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-[6px] text-zinc-300 hover:text-white bg-black/50 hover:bg-black/80 transition-colors flex items-center gap-1 text-xs"
            title={t('tickets.openOriginalImage')}
          >
            <ExternalLink className="w-4 h-4" />
            <span>Original</span>
          </a>
          <button
            type="button"
            onClick={() => setPreviewImageUrl(null)}
            className="p-1.5 rounded-[6px] text-zinc-300 hover:text-white bg-black/50 hover:bg-black/80 transition-colors cursor-pointer"
            title={t('tickets.closePreview')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <img
          src={previewImageUrl}
          alt={t('tickets.enlargedPreview')}
          className="max-h-[80vh] w-auto max-w-full object-contain rounded-[8px] shadow-2xl border border-zinc-700"
        />
      </div>
    </div>
  );
}
