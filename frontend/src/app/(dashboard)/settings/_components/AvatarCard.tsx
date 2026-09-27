import React from 'react';
import { UploadCloud, User, Loader2, Save } from 'lucide-react';

interface AvatarCardProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFileDrop: (e: React.DragEvent<HTMLElement>) => void;
  isDragOver: boolean;
  setIsDragOver: (isDragOver: boolean) => void;
  avatarUrl: string | null;
  newPreview: string | null;
  uploadingAvatar: boolean;
  presetAvatars: string[];
  pendingPreset: string | null;
  pendingFile: File | null;
  handleChoosePreset: (preset: string) => void;
  isAvatarDirty: boolean;
  handleDiscardAvatar: () => void;
  handleSaveAvatar: () => void;
  t: (key: string, params?: any) => string;
}

export function AvatarCard({
  fileInputRef,
  handleFileInputChange,
  handleFileDrop,
  isDragOver,
  setIsDragOver,
  avatarUrl,
  newPreview,
  uploadingAvatar,
  presetAvatars,
  pendingPreset,
  pendingFile,
  handleChoosePreset,
  isAvatarDirty,
  handleDiscardAvatar,
  handleSaveAvatar,
  t,
}: AvatarCardProps) {
  return (
    <div className="@container glass-card p-6 sm:p-7 space-y-6">
      {/* AVATAR CARD WITH INTEGRATED CONTROLS */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--text-primary)] font-heading tracking-tight">Avatar</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.avatarFormats')}</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* At 2560 px this card measures 1291 and right half was
          empty: 766 px void, 59%. Now drop zone occupies full
          left side—primary action, so it deserves size—and
          remaining elements sit on right: current avatar next to
          pending one, presets, and buttons.

          Showing current NEXT TO pending is the core of this
          redesign: previously only one was visible with no basis
          for comparison before saving.

          Breakpoints use `@container`, not viewport width: card
          occupies 7 of 12 columns, measuring 606 px at 1440 and
          1291 at 2560. With viewport-based `lg:`, both collapsed
          identically, reducing drop zone to 182 px at 1440. */}
      <div className="flex flex-col @3xl:flex-row gap-4 @3xl:gap-6 pt-1">
        {/* Drop zone, always present: avatar or not, it remains
            the consistent place to drop an image. */}
        <button
          type="button"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(e.dataTransfer.types.includes('Files'));
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 min-w-0 min-h-[150px] @3xl:min-h-[300px] px-4 py-8 rounded-[var(--radius-md)] border border-dashed flex flex-col items-center justify-center gap-3 text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] ${
            isDragOver
              ? 'border-[var(--accent-primary)] bg-[var(--nav-active-bg)] ring-2 ring-[var(--accent-primary)]/40'
              : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
          }`}
        >
          <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-[var(--radius-md)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] flex items-center justify-center border border-[var(--nav-active-border)] shrink-0">
            <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
          </span>
          <span className="text-xs sm:text-sm font-semibold text-[var(--text-secondary)] leading-relaxed break-words">
            {t('settings.dragImageHere')}
            <br />
            <span className="text-[var(--text-primary)] font-bold underline">
              {t('settings.clickToBrowse')}
            </span>
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            {t('settings.avatarFormats')}
          </span>
        </button>

        {/* Fixed width, not percentage: contents here—two thumbnails
            and a button row—have intrinsic dimensions, and scaling
            with card would only resurrect the previous void. */}
        <div className="@3xl:w-[400px] shrink-0 flex flex-col gap-4">

          {/* Current and pending, side by side. Width cap keeps them
              uniform across screens: without it, stacking in a wide
              card expands 50% cells into two 300 px blocks. */}
          <div className="flex gap-3">
            {[
              { clave: 'actual', title: t('settings.avatarCurrent'), src: avatarUrl },
              { clave: 'nuevo', title: t('settings.avatarNew'), src: newPreview },
            ].map(({ clave, title, src }) => {
              const isNew = clave === 'nuevo';
              const highlighted = isNew && !!src;

              return (
                <figure key={clave} className="flex-1 min-w-0 max-w-[172px] space-y-1.5">
                  <figcaption
                    className={`text-[10.5px] font-mono uppercase tracking-wider truncate ${
                      highlighted ? 'text-[var(--accent-text)] font-bold' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {title}
                  </figcaption>
                  <div
                    className={`relative w-full aspect-square rounded-[var(--radius-md)] overflow-hidden border bg-[var(--bg-app)] flex items-center justify-center ${
                      highlighted
                        ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/25'
                        : 'border-[var(--border-subtle)]'
                    }`}
                  >
                    {src ? (
                      <img src={src} alt={title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center px-2 space-y-1.5">
                        <User className="w-7 h-7 mx-auto text-[var(--text-muted)]" aria-hidden="true" />
                        <p className="text-[11px] text-[var(--text-muted)] leading-tight">
                          {isNew ? t('settings.avatarNoneChosen') : t('settings.noAvatarYet')}
                        </p>
                      </div>
                    )}

                    {isNew && uploadingAvatar && (
                      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-7 h-7 text-white animate-spin" aria-hidden="true" />
                        <span className="text-[10px] font-mono text-white font-bold">
                          {t('settings.savingAvatar')}
                        </span>
                      </div>
                    )}
                  </div>
                </figure>
              );
            })}
          </div>

          {/* Default avatars, for users who prefer not to upload a photo */}
          {presetAvatars.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                {t('settings.presetAvatars')}
              </span>
              <div className="flex flex-wrap gap-2">
                {presetAvatars.map((preset) => {
                  // Outline marks selected item, not saved one: while
                  // pending, user needs to see what will apply.
                  const selected = pendingPreset
                    ? pendingPreset === preset
                    : !pendingFile && avatarUrl === preset;

                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleChoosePreset(preset)}
                      disabled={uploadingAvatar}
                      aria-pressed={selected}
                      className={`w-12 h-12 rounded-[var(--radius-md)] overflow-hidden border-2 transition-all cursor-pointer disabled:opacity-40 ${
                        selected
                          ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30'
                          : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <img
                        src={preset}
                        alt=""
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save, at column bottom: nothing chosen above
              applies until clicked. */}
          <div className="flex items-center gap-2 mt-auto pt-1">
            {isAvatarDirty && (
              <button
                type="button"
                onClick={handleDiscardAvatar}
                className="shrink-0 px-3 py-2.5 rounded-[var(--radius-md)] text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              >
                {t('settings.discardAvatar')}
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveAvatar}
              disabled={uploadingAvatar || !isAvatarDirty}
              className={`flex-1 py-2.5 rounded-[var(--radius-md)] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-default ${
                isAvatarDirty ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              {uploadingAvatar ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="w-4 h-4" aria-hidden="true" />
              )}
              <span>
                {isAvatarDirty ? t('settings.saveAvatarChanges') : t('settings.avatarUpToDate')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
