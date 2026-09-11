'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useUnsavedChanges } from '@/components/UnsavedChangesProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  User,
  UploadCloud,
  Mail,
  Save,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Clock,
  RotateCcw,
  Palette,
  Check,
  BarChart2,
  Star,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface ThemeSwatch {
  id: string;
  name: string;
  bgColor: string;
  dotColor?: string;
  borderColor?: string;
  palette?: string;
  mode?: 'dark' | 'light';
  isAuto?: boolean;
}

/**
 * Traduce nombres de paleta antiguos a los actuales.
 *
 * Las paletas se llamaban por el producto del que se copió su aspecto. Ese
 * nombre ya está guardado en localStorage y en settings.themePalette de la base
 * de datos, así que renombrarlas a secas dejaría a esos usuarios con una paleta
 * inexistente y el fondo por defecto. Aquí se traducen al vuelo.
 */
const PALETAS_HEREDADAS: Record<string, string> = {
  'discord-dark': 'grafito',
  'discord-ash': 'carbon',
  'discord-light': 'marfil',
};

export function normalizarPaleta(paleta?: string | null): string {
  if (!paleta) return 'sync';
  return PALETAS_HEREDADAS[paleta] ?? paleta;
}

export const THEME_SWATCHES: ThemeSwatch[] = [
  {
    id: 'claro',
    name: 'settings.themeLight',
    bgColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.15)',
    palette: 'marfil',
    mode: 'light',
  },
  // Los nombres visibles estaban intercambiados respecto al color que aplican:
  // "Oscuro" pintaba #313338 (gris) y "Ceniza" pintaba #111214 (casi negro).
  // Venía de heredar la nomenclatura del producto del que se copió el aspecto,
  // donde el tema llamado "oscuro" es precisamente el gris.
  // Se corrigen las etiquetas; los `id` se conservan porque están guardados en
  // localStorage, y las paletas renombradas se traducen en normalizarPaleta().
  {
    id: 'oscuro',
    name: 'settings.themeAsh',
    bgColor: '#313338',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    palette: 'grafito',
    mode: 'dark',
  },
  {
    id: 'ceniza',
    name: 'settings.themeDark',
    bgColor: '#111214',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    palette: 'carbon',
    mode: 'dark',
  },
  {
    id: 'sync',
    name: 'settings.themeSync',
    bgColor: '#1A1A1A',
    dotColor: '#FF634A',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    palette: 'sync',
    mode: 'dark',
  },
  {
    id: 'plex',
    name: 'settings.themePlex',
    bgColor: '#171717',
    dotColor: '#E5A00D',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    palette: 'plex',
    mode: 'dark',
  },
  {
    id: 'auto',
    name: 'settings.syncWithSystem',
    bgColor: '#2B2D31',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    isAuto: true,
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();
  const { setDirty, registerSaveHandler } = useUnsavedChanges();

  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);

  // Tema & Apariencia (Swatches)
  const [selectedThemeId, setSelectedThemeId] = useState<string>('sync');
  const [themePalette, setThemePalette] = useState<string>('sync');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');

  // Perfil & Datos de Cuenta
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Avatar. No hay recorte: la imagen se manda tal cual y el servidor la
  // normaliza a 256x256, asi que aqui solo hay eleccion y vista previa.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  // Lo elegido pero aun sin guardar: uno de los dos, nunca los dos a la vez.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [presetAvatars, setPresetAvatars] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAvatarDirty = !!pendingFile || !!pendingPreset;

  // Lo que se va a poner, separado de lo que ya hay guardado: la tarjeta ensena
  // los dos a la vez para poder compararlos antes de guardar.
  const previaNueva = isAvatarDirty ? previewSrc : null;

  // Detección de cambios sin guardar
  const hasUnsavedChanges =
    isAvatarDirty ||
    (userProfile && (username !== (userProfile.username || '') || email !== (userProfile.email || '')));

  useEffect(() => {
    setDirty(Boolean(hasUnsavedChanges));
  }, [hasUnsavedChanges, setDirty]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const meRes = await api.auth.me();
      const user = meRes?.user || meRes;
      if (!user) {
        router.push('/login');
        return;
      }
      setUserProfile(user);
      setUsername(user.username || '');
      setEmail(user.email || '');

      const currentAvatar = user.avatarUrl
        ? user.avatarUrl.startsWith('http')
          ? user.avatarUrl
          : user.avatarUrl.startsWith('/')
          ? user.avatarUrl
          : `/api/auth/avatar/${user.avatarUrl}`
        : null;

      setAvatarUrl(currentAvatar);
      setPreviewSrc(currentAvatar);
      setPendingFile(null);
      setPendingPreset(null);

      // Si la lista de predeterminados falla, la tarjeta simplemente no los
      // muestra: subir una foto propia sigue funcionando igual.
      api.auth
        .presetAvatars()
        .then((res) => setPresetAvatars(res.avatars || []))
        .catch(() => setPresetAvatars([]));

      // Cargar configuración de Tema & Apariencia
      const currentPalette = normalizarPaleta(
        localStorage.getItem('plexsync_palette') || user?.settings?.themePalette || 'sync',
      );
      const currentMode = (localStorage.getItem('plexsync_theme') as 'dark' | 'light') || (user?.settings?.themeMode as 'dark' | 'light') || 'dark';
      const savedThemeId = localStorage.getItem('plexsync_selected_theme');

      let themeId = savedThemeId;
      if (!themeId) {
        if (currentMode === 'light') themeId = 'claro';
        else if (currentPalette === 'carbon') themeId = 'ceniza';
        else if (currentPalette === 'grafito') themeId = 'oscuro';
        else if (currentPalette === 'plex') themeId = 'plex';
        else themeId = 'sync';
      }

      setSelectedThemeId(themeId);
      setThemePalette(currentPalette);
      setThemeMode(currentMode);
      document.documentElement.setAttribute('data-palette', currentPalette);
      document.documentElement.setAttribute('data-theme', currentMode);

      // Cargar estadísticas de visualización del usuario
      try {
        const stats = await api.catalog.getUserStats();
        setUserStats(stats);
      } catch (err) {
        // Silencioso si no hay datos aún
      }
    } catch (e: any) {
      showToast(`${t('settings.loadProfileError')} ` + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Selección instantánea de tema mediante muestras de color
  const handleSelectTheme = async (swatch: ThemeSwatch) => {
    setSelectedThemeId(swatch.id);
    localStorage.setItem('plexsync_selected_theme', swatch.id);

    if (swatch.isAuto) {
      const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const autoMode: 'dark' | 'light' = prefersDark ? 'dark' : 'light';
      const autoPalette = 'sync';
      setThemeMode(autoMode);
      setThemePalette(autoPalette);
      localStorage.setItem('plexsync_theme', autoMode);
      localStorage.setItem('plexsync_palette', autoPalette);
      document.documentElement.setAttribute('data-theme', autoMode);
      document.documentElement.setAttribute('data-palette', autoPalette);
      try {
        await api.connections.updateSettings({ themeMode: autoMode, themePalette: autoPalette });
      } catch {}
      showToast(t('settings.themeSyncedWithSystem'), 'info');
      return;
    }

    const newPalette = swatch.palette || 'sync';
    const newMode = swatch.mode || 'dark';

    setThemePalette(newPalette);
    setThemeMode(newMode);
    localStorage.setItem('plexsync_palette', newPalette);
    localStorage.setItem('plexsync_theme', newMode);
    document.documentElement.setAttribute('data-palette', newPalette);
    document.documentElement.setAttribute('data-theme', newMode);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('plexsync_theme_changed'));
    }

    try {
      await api.connections.updateSettings({ themePalette: newPalette, themeMode: newMode });
      showToast(t('settings.themeActivated', { theme: t(swatch.name) }), 'success');
    } catch {}
  };

  // Procesar archivo seleccionado o arrastrado
  const handleProcessFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(t('settings.selectValidImage'), 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(t('settings.imageOverTenMb'), 'error');
      return;
    }

    // Solo se previsualiza. Nada llega al servidor hasta que se pulsa guardar.
    const reader = new FileReader();
    reader.onload = () => {
      setPendingFile(file);
      setPendingPreset(null);
      setPreviewSrc(reader.result as string);
      showToast(t('settings.imageLoadedAdjust'), 'info');
    };
    reader.readAsDataURL(file);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
    // Se limpia siempre: sin esto, volver a elegir el mismo fichero tras
    // descartar no dispara el evento y parece que no hace nada.
    e.target.value = '';
  };

  /**
   * Elegir un avatar predeterminado solo lo deja pendiente: se ve en la vista
   * previa y no cambia nada hasta pulsar guardar, igual que subir una imagen.
   */
  const handleChoosePreset = (preset: string) => {
    setPendingPreset(preset);
    setPendingFile(null);
    setPreviewSrc(preset);
  };

  /** Volver a lo que hay guardado, descartando lo elegido. */
  const handleDescartarAvatar = () => {
    setPendingFile(null);
    setPendingPreset(null);
    setPreviewSrc(avatarUrl);
  };

  /**
   * Guardar lo que este pendiente, sea un fichero o un predeterminado.
   *
   * La imagen se manda tal cual: el servidor ya la reescribe a 256x256 con
   * sharp, que ademas es lo que neutraliza cualquier carga incrustada. Recortar
   * aqui con un canvas solo anadia una copia peor de ese mismo trabajo.
   */
  const handleSaveAvatar = async () => {
    if (!pendingFile && !pendingPreset) {
      showToast(t('settings.selectOrDragAvatar'), 'info');
      return;
    }

    setUploadingAvatar(true);
    try {
      let res;
      if (pendingPreset) {
        res = await api.auth.setPresetAvatar(pendingPreset);
      } else {
        const formData = new FormData();
        formData.append('avatar', pendingFile as File, (pendingFile as File).name);
        res = await api.auth.uploadAvatar(formData);
      }

      setAvatarUrl(res.avatarUrl);
      setPreviewSrc(res.avatarUrl);
      setPendingFile(null);
      setPendingPreset(null);

      showToast(t('settings.avatarSaved'), 'success');
      loadData();
    } catch (err: any) {
      showToast(`${t('settings.saveAvatarError')} ` + err.message, 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Guardar Datos de Cuenta (Username / Email)
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      showToast(t('settings.usernameCannotBeEmpty'), 'error');
      return;
    }

    try {
      setSavingAccount(true);
      await api.auth.updateProfile({
        username: username.trim(),
        email: email.trim(),
        currentPassword: email.trim().toLowerCase() !== userProfile?.email?.toLowerCase()
          ? accountPassword
          : undefined,
      });
      showToast(t('settings.accountDataUpdated'), 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || t('settings.updateAccountError'), 'error');
    } finally {
      setSavingAccount(false);
    }
  };

  useEffect(() => {
    if (hasUnsavedChanges) {
      registerSaveHandler(async () => {
        if (isAvatarDirty && previewSrc) {
          await handleSaveAvatar();
        }
        if (userProfile && (username !== (userProfile.username || '') || email !== (userProfile.email || ''))) {
          if (username.trim()) {
            await api.auth.updateProfile({
              username: username.trim(),
              email: email.trim(),
              currentPassword: email.trim().toLowerCase() !== userProfile.email?.toLowerCase()
                ? accountPassword
                : undefined,
            });
            showToast(t('settings.accountDataUpdated'), 'success');
          }
        }
        return true;
      });
    } else {
      registerSaveHandler(null);
    }
  }, [hasUnsavedChanges, isAvatarDirty, previewSrc, userProfile, username, email, accountPassword, registerSaveHandler]);

  // Cálculo de días para próximo cambio de nombre
  const getDaysUntilUsernameChange = () => {
    if (!userProfile?.lastUsernameChange) return null;
    const last = new Date(userProfile.lastUsernameChange).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const remainingMs = last + thirtyDaysMs - Date.now();
    if (remainingMs <= 0) return null;
    return Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = getDaysUntilUsernameChange();

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('topbar.settings')} currentLabel={t('settings.profileTitle')} />

      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('settings.profileTitle')}</h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('settings.profileSubtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-8 min-w-0">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-text)]" />
            <span className="text-xs font-mono text-[var(--text-muted)]">{t('settings.loadingProfile')}</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* COLUMNA IZQUIERDA: AVATAR INTERACTIVO UNIFICADO & ROL (7 COLS) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* CARD DE AVATAR CON CONTROLES INTEGRADOS */}
              <div className="@container glass-card p-6 sm:p-7 space-y-6">
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

              {/* CARD COMPLEMENTARIO: IDENTIDAD & ROL */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('settings.accountStatus')}</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                    <span className="text-[10.5px] font-mono text-[var(--text-muted)] uppercase">{t('settings.systemRole')}</span>
                    <div className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${userProfile?.role === 'ADMIN' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                      {userProfile?.role === 'ADMIN' ? t('settings.roleAdmin') : t('settings.roleUser')}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                    <span className="text-[10.5px] font-mono text-[var(--text-muted)] uppercase">{t('settings.auth2fa')}</span>
                    <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {userProfile?.twoFactorEnabled ? t('settings.auth2faProtected') : t('settings.auth2faBasic')}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                    <span className="text-[10.5px] font-mono text-[var(--text-muted)] uppercase">{t('settings.memberSince')}</span>
                    <div className="text-sm font-bold text-[var(--text-secondary)] font-mono">
                      {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : '2026'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: DATOS DE CUENTA & RESUMEN (5 COLS) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="glass-card p-6 sm:p-7 space-y-6">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)] font-heading tracking-tight">{t('settings.accountData')}</h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {t('settings.accountDataSubtitle')}
                  </p>
                </div>

                <form onSubmit={handleSaveAccount} className="space-y-4 pt-1">
                  {/* Nombre de usuario */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="ajustes-nombre-usuario" className="text-xs font-semibold text-[var(--text-secondary)]">{t('settings.username')}</label>
                      {daysRemaining ? (
                        <span className="text-[10.5px] font-mono text-amber-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {t('settings.changeAvailableIn', { days: daysRemaining })}
                        </span>
                      ) : (
                        <span className="text-[10.5px] font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {t('settings.changeAvailable')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] focus-within:border-[var(--border-focus)] focus-within:ring-1 focus-within:ring-[var(--border-focus)] transition-all">
                      <User className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                      <input
                        id="ajustes-nombre-usuario"
                        type="text"
                        suppressHydrationWarning
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t('settings.yourUsername')}
                        className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                      />
                    </div>
                  </div>

                  {/* Correo electrónico */}
                  <div className="space-y-1.5">
                    <label htmlFor="ajustes-correo" className="text-xs font-semibold text-[var(--text-secondary)]">{t('settings.email')}</label>
                    <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] focus-within:border-[var(--border-focus)] focus-within:ring-1 focus-within:ring-[var(--border-focus)] transition-all">
                      <Mail className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                      <input
                        id="ajustes-correo"
                        type="email"
                        suppressHydrationWarning
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('auth.emailPlaceholder')}
                        className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                      />
                    </div>
                  </div>

                  {email.trim().toLowerCase() !== userProfile?.email?.toLowerCase() && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('settings.currentPasswordToConfirm')}</label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        className="glass-input text-sm"
                        required
                      />
                      <p className="text-[10.5px] text-[var(--text-muted)]">{t('settings.emailNotAppliedUntilConfirmed')}</p>
                    </div>
                  )}

                  {/* User Token Info */}
                  <div className="p-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[var(--text-muted)]">User Token Privado:</span>
                      <span className="text-[var(--text-primary)] font-bold">{userProfile?.userToken}</span>
                    </div>
                    <p className="text-[10.5px] text-[var(--text-muted)]">{t('settings.permanentSessionId')}</p>
                  </div>

                  <button
                    type="submit"
                    disabled={savingAccount}
                    className="btn-primary w-full py-2.5"
                  >
                    {savingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{t('settings.saveChanges')}</span>
                  </button>
                </form>
              </div>

              {/* CARD DE PERSONALIZACIÓN DE TEMAS (ESTILO DISCORD) */}
              <div className="glass-card p-6 sm:p-7 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[6px] bg-[var(--color-brand-primary)]/10 border border-[var(--color-brand-primary)]/20 flex items-center justify-center text-[var(--color-brand-primary)] shrink-0">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading tracking-tight">{t('settings.appearance')}</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {t('settings.appearanceSubtitle')}
                    </p>
                  </div>
                </div>

                {/* Fila horizontal de muestras de tema */}
                <div className="flex items-center gap-3 pt-2 pb-1 flex-wrap">
                  {THEME_SWATCHES.map((swatch) => {
                    const isSelected = selectedThemeId === swatch.id;
                    return (
                      <div key={swatch.id} className="relative group">
                        <button
                          type="button"
                          onClick={() => handleSelectTheme(swatch)}
                          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-[10px] transition-all duration-150 cursor-pointer relative flex items-center justify-center shadow-sm hover:scale-[1.06] active:scale-[0.98] ${
                            isSelected
                              ? 'ring-2 ring-[var(--color-brand-primary)] ring-offset-2 ring-offset-[var(--bg-app)]'
                              : 'border hover:border-[var(--border-strong)]'
                          }`}
                          style={{
                            backgroundColor: swatch.bgColor,
                            borderColor: swatch.borderColor || 'var(--border-subtle)',
                          }}
                          aria-label={t(swatch.name)}
                        >
                          {/* Contenido interior: dot de color o icono de rotación */}
                          {swatch.dotColor && (
                            <span
                              className="w-3.5 h-3.5 rounded-full shadow-md"
                              style={{ backgroundColor: swatch.dotColor }}
                            />
                          )}
                          {swatch.isAuto && (
                            <RotateCcw className="w-4.5 h-4.5 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
                          )}

                          {/* Badge de Selección (Check circular en la esquina superior derecha) */}
                          {isSelected && (
                            <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[var(--color-brand-primary)] text-white flex items-center justify-center shadow-md border-2 border-[var(--bg-app)] animate-in zoom-in-50 duration-150">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                        </button>

                        {/* Tooltip flotante con flecha apuntando hacia abajo */}
                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[6px] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-[11px] font-semibold shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 transform group-hover:-translate-y-0.5 z-30 whitespace-nowrap">
                          {t(swatch.name)}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--bg-surface-elevated)] border-r border-b border-[var(--border-subtle)] rotate-45" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Resumen del Tema Activo */}
                <div className="pt-2.5 flex items-center justify-between text-xs text-[var(--text-secondary)] border-t border-[var(--border-subtle)]">
                  <span className="font-medium">{t('settings.activeTheme')}</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">
                    {t(THEME_SWATCHES.find((s) => s.id === selectedThemeId)?.name || 'settings.themeSync')}
                  </span>
                </div>
              </div>
            </div>
          </div>

            {/* SECCIÓN EXPANDIDA: ESTADÍSTICAS GLOBALES CONSOLIDADAS (ANCHO 100%) */}
            <div className="glass-card p-6 sm:p-7 space-y-6 border-amber-500/40 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--glass-border)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
                    <BarChart2 className="w-5 h-5 text-[var(--accent-text)]" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading tracking-tight">{t('settings.globalViewingStats')}</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.globalViewingStatsDesc')}</p>
                  </div>
                </div>
                <span className="badge-pill font-mono text-xs self-start sm:self-auto">
                  {userStats?.totalShows ?? 0} series en catálogo
                </span>
              </div>

              {/* Grid de 6 Métricas Globales */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 font-mono">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">SERIES TOTALES</span>
                  <div className="text-2xl font-bold text-[var(--text-primary)]">
                    {userStats?.totalShows ?? 0}
                  </div>
                  <p className="text-[10.5px] text-[var(--text-muted)]">{t('settings.inLibrary')}</p>
                </div>

                <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 font-mono">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">EPISODIOS VISTOS</span>
                  <div className="text-2xl font-bold text-[var(--text-primary)]">
                    {userStats?.totalEpisodes ? userStats.totalEpisodes.toLocaleString() : 0}
                  </div>
                  <p className="text-[10.5px] text-emerald-400 font-semibold">{userStats?.completedCount ?? 0} completados</p>
                </div>

                <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 font-mono">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">TIEMPO TOTAL</span>
                  <div className="text-2xl font-bold text-[var(--text-primary)]">
                    {userStats?.totalHours ?? 0}h
                  </div>
                  <p className="text-[10.5px] text-[var(--text-muted)]">~{userStats?.totalDays ?? 0} días netos</p>
                </div>

                <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 font-mono">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">NOTA MEDIA</span>
                  <div className="text-2xl font-bold text-amber-400 flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{userStats?.meanScore ?? '8.5'}</span>
                  </div>
                  <p className="text-[10.5px] text-[var(--text-muted)]">{t('settings.averageRating')}</p>
                </div>

                <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 font-mono">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{t('settings.watching')}</span>
                  <div className="text-2xl font-bold text-sky-400">
                    {userStats?.watchingCount ?? 0}
                  </div>
                  <p className="text-[10.5px] text-[var(--text-muted)]">series activas</p>
                </div>

                <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 font-mono">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">FAVORITOS</span>
                  <div className="text-2xl font-bold text-rose-400">
                    {userStats?.favoritesCount ?? 0}
                  </div>
                  <p className="text-[10.5px] text-[var(--text-muted)]">destacados</p>
                </div>
              </div>

              {/* Desglose de Géneros con Barras Horizontales */}
              <div className="p-4 sm:p-5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] font-heading flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                    <span>{t('settings.favouriteGenres')}</span>
                  </h4>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    Calculado sobre {userStats?.totalEpisodes ? userStats.totalEpisodes.toLocaleString() : 0} episodios
                  </span>
                </div>

                <div className="space-y-2.5 pt-1">
                  {(userStats?.topGenres && userStats.topGenres.length > 0 ? userStats.topGenres : [
                    { name: 'Acción', percentage: 35 },
                    { name: 'Shounen', percentage: 28 },
                    { name: 'Fantasía', percentage: 22 },
                    { name: 'Drama', percentage: 15 },
                    { name: 'Comedia', percentage: 12 },
                  ]).map((g: any, idx: number) => {
                    const colors = ['bg-sky-400', 'bg-purple-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400'];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={g.name} className="flex items-center gap-3 text-xs font-mono">
                        <span className="w-28 font-semibold text-[var(--text-secondary)] truncate">
                          {g.name}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${color}`}
                            style={{ width: `${Math.min(100, g.percentage || 0)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-bold text-[var(--text-primary)]">
                          {g.percentage || 0}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
