'use client';

import React from 'react';
import {
  Image as ImageIcon,
  Loader2,
  X,
} from 'lucide-react';

interface PresetAvatarsSectionProps {
  presetAvatars: string[];
  uploadingPreset: boolean;
  presetInputRef: React.RefObject<HTMLInputElement | null>;
  handlePresetFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemovePreset: (preset: string) => void;
  t: (key: string, values?: any) => string;
}

export function PresetAvatarsSection({
  presetAvatars,
  uploadingPreset,
  presetInputRef,
  handlePresetFileChange,
  handleRemovePreset,
  t,
}: PresetAvatarsSectionProps) {
  return (
    <>
        {/* AVATARES PREDETERMINADOS: los que se ofrecen a quien no sube foto */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                {t('admin.presetAvatarsTitle')}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {t('admin.presetAvatarsSubtitle')}
              </p>
            </div>
            <input
              ref={presetInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handlePresetFileChange}
            />
            <button
              onClick={() => presetInputRef.current?.click()}
              disabled={uploadingPreset}
              className="btn-secondary shrink-0"
            >
              {uploadingPreset ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              )}
              <span>{t('admin.presetAvatarsAdd')}</span>
            </button>
          </div>

          {presetAvatars.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-2">{t('admin.presetAvatarsEmpty')}</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {presetAvatars.map((preset) => (
                <div key={preset} className="relative group">
                  <img
                    src={preset}
                    alt=""
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-[6px] object-cover border border-[var(--border-subtle)]"
                  />
                  <button
                    onClick={() => handleRemovePreset(preset)}
                    title={t('admin.presetAvatarsRemove')}
                    aria-label={t('admin.presetAvatarsRemove')}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer shadow-md"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
    </>
  );
}
