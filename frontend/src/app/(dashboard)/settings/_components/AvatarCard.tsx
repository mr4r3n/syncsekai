import React from 'react';
import { UploadCloud, User, Loader2, Save } from 'lucide-react';

interface AvatarCardProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFileDrop: (e: React.DragEvent<HTMLElement>) => void;
  isDragOver: boolean;
  setIsDragOver: (isDragOver: boolean) => void;
  avatarUrl: string | null;
  previaNueva: string | null;
  uploadingAvatar: boolean;
  presetAvatars: string[];
  pendingPreset: string | null;
  pendingFile: File | null;
  handleChoosePreset: (preset: string) => void;
  isAvatarDirty: boolean;
  handleDescartarAvatar: () => void;
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
  previaNueva,
  uploadingAvatar,
  presetAvatars,
  pendingPreset,
  pendingFile,
  handleChoosePreset,
  isAvatarDirty,
  handleDescartarAvatar,
  handleSaveAvatar,
  t,
}: AvatarCardProps) {
  return (
    <div className="@container glass-card p-6 sm:p-7 space-y-6">
      {/* CARD DE AVATAR CON CONTROLES INTEGRADOS */}
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

      {/* A 2560 px esta tarjeta mide 1291 y la mitad derecha se
          quedaba vacia: 766 px de hueco, el 59%. Ahora la zona de
          arrastre ocupa todo el lado izquierdo -es la accion
          principal, asi que es la que debe ser grande- y a la derecha
          va el resto: el avatar actual junto al que se va a poner, los
          predeterminados y los botones.

          Ensenar el actual AL LADO del nuevo es el punto de la
          reordenacion: antes solo se veia uno y no habia con que
          comparar antes de guardar.

          Los cortes van por `@container`, no por el ancho de la
          ventana: esta tarjeta ocupa 7 de 12 columnas, asi que a 1440
          mide 606 px y a 2560 mide 1291. Con `lg:` -que mira la
          ventana- las dos caian del mismo lado y a 1440 la zona de
          arrastre se quedaba en 182 px. */}
      <div className="flex flex-col @3xl:flex-row gap-4 @3xl:gap-6 pt-1">
        {/* Zona de arrastre, siempre presente: haya avatar o no, es el
            mismo sitio donde soltar la imagen. */}
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

        {/* Ancho fijo, no un porcentaje: lo que va aqui -dos miniaturas
            y una fila de botones- tiene un tamano natural, y dejarlo
            crecer con la tarjeta solo repetiria el hueco de antes. */}
        <div className="@3xl:w-[400px] shrink-0 flex flex-col gap-4">

          {/* El actual y el nuevo, uno al lado del otro. El tope de
              ancho es lo que los deja del mismo tamano en todas las
              pantallas: sin el, al apilarse en una tarjeta ancha, dos
              celdas al 50% se convierten en dos bloques de 300 px. */}
          <div className="flex gap-3">
            {[
              { clave: 'actual', titulo: t('settings.avatarCurrent'), src: avatarUrl },
              { clave: 'nuevo', titulo: t('settings.avatarNew'), src: previaNueva },
            ].map(({ clave, titulo, src }) => {
              const esNuevo = clave === 'nuevo';
              const destacado = esNuevo && !!src;

              return (
                <figure key={clave} className="flex-1 min-w-0 max-w-[172px] space-y-1.5">
                  <figcaption
                    className={`text-[10.5px] font-mono uppercase tracking-wider truncate ${
                      destacado ? 'text-[var(--accent-text)] font-bold' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {titulo}
                  </figcaption>
                  <div
                    className={`relative w-full aspect-square rounded-[var(--radius-md)] overflow-hidden border bg-[var(--bg-app)] flex items-center justify-center ${
                      destacado
                        ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/25'
                        : 'border-[var(--border-subtle)]'
                    }`}
                  >
                    {src ? (
                      <img src={src} alt={titulo} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center px-2 space-y-1.5">
                        <User className="w-7 h-7 mx-auto text-[var(--text-muted)]" aria-hidden="true" />
                        <p className="text-[11px] text-[var(--text-muted)] leading-tight">
                          {esNuevo ? t('settings.avatarNoneChosen') : t('settings.noAvatarYet')}
                        </p>
                      </div>
                    )}

                    {esNuevo && uploadingAvatar && (
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

          {/* Avatares predeterminados, para quien no quiera subir foto */}
          {presetAvatars.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                {t('settings.presetAvatars')}
              </span>
              <div className="flex flex-wrap gap-2">
                {presetAvatars.map((preset) => {
                  // El marco marca lo elegido, no lo guardado: mientras
                  // este pendiente hay que ver cual se va a aplicar.
                  const elegido = pendingPreset
                    ? pendingPreset === preset
                    : !pendingFile && avatarUrl === preset;

                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleChoosePreset(preset)}
                      disabled={uploadingAvatar}
                      aria-pressed={elegido}
                      className={`w-12 h-12 rounded-[var(--radius-md)] overflow-hidden border-2 transition-all cursor-pointer disabled:opacity-40 ${
                        elegido
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

          {/* Guardar, al fondo de la columna: nada de lo elegido arriba
              se aplica hasta pulsarlo. */}
          <div className="flex items-center gap-2 mt-auto pt-1">
            {isAvatarDirty && (
              <button
                type="button"
                onClick={handleDescartarAvatar}
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
