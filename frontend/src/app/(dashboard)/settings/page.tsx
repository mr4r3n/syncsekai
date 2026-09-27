'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useUnsavedChanges } from '@/components/UnsavedChangesProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  User,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ThemeSwatch } from './_components/types';
import { normalizePalette, THEME_SWATCHES } from './_components/constants';
import { AvatarCard } from './_components/AvatarCard';
import { AccountStatusCard } from './_components/AccountStatusCard';
import { AccountDataCard } from './_components/AccountDataCard';
import { ThemeSwatchesCard } from './_components/ThemeSwatchesCard';
import { ViewingStatsSection } from './_components/ViewingStatsSection';

export type { ThemeSwatch };
export { normalizePalette, THEME_SWATCHES };

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

  // Avatar. No cropping: image is sent as-is and server
  // normalizes to 256x256, so here there is only selection and preview.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  // Selected but not yet saved: one of the two, never both at once.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [presetAvatars, setPresetAvatars] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAvatarDirty = !!pendingFile || !!pendingPreset;

  // What will be set, separate from what is saved: card shows
  // both simultaneously for comparison before saving.
  const newPreview = isAvatarDirty ? previewSrc : null;

  // Unsaved changes detection
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

      // If preset list fails, card simply does not
      // show them: uploading a custom photo still works.
      api.auth
        .presetAvatars()
        .then((res) => setPresetAvatars(res.avatars || []))
        .catch(() => setPresetAvatars([]));

      // Load Theme & Appearance settings
      const currentPalette = normalizePalette(
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

      // Load user viewing stats
      try {
        const stats = await api.catalog.getUserStats();
        setUserStats(stats);
      } catch (err) {
        // Silent if no data yet
      }
    } catch (e: any) {
      showToast(`${t('settings.loadProfileError')} ` + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Instant theme selection via color swatches
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

  // Process selected or dropped file
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

    // Preview only. Nothing reaches server until save is clicked.
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
    // Always cleared: without this, reselecting same file after
    // discarding does not trigger event and appears non-responsive.
    e.target.value = '';
  };

  /**
   * Choosing a preset avatar only marks it pending: displayed in preview
   * and modifies nothing until save is clicked, just like uploading an image.
   */
  const handleChoosePreset = (preset: string) => {
    setPendingPreset(preset);
    setPendingFile(null);
    setPreviewSrc(preset);
  };

  /** Revert to saved avatar, discarding selected one. */
  const handleDiscardAvatar = () => {
    setPendingFile(null);
    setPendingPreset(null);
    setPreviewSrc(avatarUrl);
  };

  /**
   * Save pending avatar, whether file or preset.
   *
   * Image is sent as-is: server already rewrites to 256x256 with
   * sharp, which also neutralizes embedded payloads. Cropping
   * here with a canvas only added an inferior duplicate of that work.
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

  // Calculation of days until next username change
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

      {/* TOP HEADER (STATIC ON MOBILE, STICKY ON DESKTOP) */}
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
              <AvatarCard
                fileInputRef={fileInputRef}
                handleFileInputChange={handleFileInputChange}
                handleFileDrop={handleFileDrop}
                isDragOver={isDragOver}
                setIsDragOver={setIsDragOver}
                avatarUrl={avatarUrl}
                newPreview={newPreview}
                uploadingAvatar={uploadingAvatar}
                presetAvatars={presetAvatars}
                pendingPreset={pendingPreset}
                pendingFile={pendingFile}
                handleChoosePreset={handleChoosePreset}
                isAvatarDirty={isAvatarDirty}
                handleDiscardAvatar={handleDiscardAvatar}
                handleSaveAvatar={handleSaveAvatar}
                t={t}
              />
              <AccountStatusCard userProfile={userProfile} t={t} />
            </div>

            {/* COLUMNA DERECHA: DATOS DE CUENTA & RESUMEN (5 COLS) */}
            <div className="lg:col-span-5 space-y-6">
              <AccountDataCard
                handleSaveAccount={handleSaveAccount}
                username={username}
                setUsername={setUsername}
                daysRemaining={daysRemaining}
                email={email}
                setEmail={setEmail}
                accountPassword={accountPassword}
                setAccountPassword={setAccountPassword}
                userProfile={userProfile}
                savingAccount={savingAccount}
                t={t}
              />
              <ThemeSwatchesCard
                selectedThemeId={selectedThemeId}
                handleSelectTheme={handleSelectTheme}
                t={t}
              />
            </div>
          </div>

            <ViewingStatsSection userStats={userStats} t={t} />
          </div>
        )}
      </main>
    </div>
  );
}
