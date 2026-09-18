'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useUnsavedChanges } from '@/components/UnsavedChangesProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Bell,
  Mail,
  MessageSquare,
  Save,
  Loader2,
  ShieldCheck,
  Send,
  Radio,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { HistorialNotificaciones } from '@/components/HistorialNotificaciones';

export default function NotificationsSettingsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();
  const { setDirty, registerSaveHandler } = useUnsavedChanges();

  const [loading, setLoading] = useState(true);
  const [emailErrorAlerts, setEmailErrorAlerts] = useState(true);
  const [webNotifications, setWebNotifications] = useState(true);
  const [discordNotifications, setDiscordNotifications] = useState(true);

  const [initialSettings, setInitialSettings] = useState<{
    emailErrorAlerts: boolean;
    webNotifications: boolean;
    discordNotifications: boolean;
  } | null>(null);

  const [savingNotifications, setSavingNotifications] = useState(false);
  const [sendingDiscordTest, setSendingDiscordTest] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  const isDirty = Boolean(
    initialSettings !== null &&
      (emailErrorAlerts !== initialSettings.emailErrorAlerts ||
        webNotifications !== initialSettings.webNotifications ||
        discordNotifications !== initialSettings.discordNotifications),
  );

  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty, setDirty]);

  useEffect(() => {
    if (isDirty) {
      registerSaveHandler(async () => {
        await api.auth.updateSettings({
          emailErrorAlerts,
          webNotifications,
          discordNotifications,
        });
        setInitialSettings({
          emailErrorAlerts,
          webNotifications,
          discordNotifications,
        });
        showToast(t('notifications.preferencesSaved'), 'success');
        return true;
      });
    } else {
      registerSaveHandler(null);
    }
  }, [isDirty, emailErrorAlerts, webNotifications, discordNotifications, registerSaveHandler, showToast]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.auth.me();
      const user = res?.user || res;
      if (!user) {
        router.push('/login');
        return;
      }
      setUserProfile(user);

      const settingsObj = user.settings || user.preferences;
      const emailVal = settingsObj?.emailErrorAlerts ?? true;
      const webVal = settingsObj?.webNotifications ?? true;
      const discordVal = settingsObj?.discordNotifications ?? true;

      setEmailErrorAlerts(emailVal);
      setWebNotifications(webVal);
      setDiscordNotifications(discordVal);

      setInitialSettings({
        emailErrorAlerts: emailVal,
        webNotifications: webVal,
        discordNotifications: discordVal,
      });
    } catch (e: any) {
      showToast(e.message || t('notifications.loadPreferencesError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSavingNotifications(true);
      await api.auth.updateSettings({
        emailErrorAlerts,
        webNotifications,
        discordNotifications,
      });
      setInitialSettings({
        emailErrorAlerts,
        webNotifications,
        discordNotifications,
      });
      showToast(t('notifications.preferencesSaved'), 'success');
    } catch (e: any) {
      showToast(t('notifications.savePreferencesError'), 'error');
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleTestDiscord = async () => {
    try {
      setSendingDiscordTest(true);
      const res = await api.notifications.testDiscord();
      showToast(res.message || t('notifications.testMessageSent'), 'success');
    } catch (e: any) {
      showToast(e.message || t('notifications.testMessageError'), 'error');
    } finally {
      setSendingDiscordTest(false);
    }
  };

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('topbar.settings')} currentLabel={t('notifications.title')} />

      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <Bell className="w-4 h-4 text-amber-400" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
                  {t('notifications.title')}
                </h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('notifications.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL EN DOS COLUMNAS */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-8 min-w-0">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-text)]" />
            <span className="text-xs font-mono text-[var(--text-muted)]">{t('notifications.loadingPreferences')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUMNA IZQUIERDA: CONFIGURACIÓN DE CANALES (7 COLS) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="glass-card p-6 sm:p-7 space-y-6">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
                    <Bell className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('notifications.alertChannels')}</h2>
                    <p className="text-xs text-[var(--text-secondary)]">{t('notifications.alertChannelsDesc')}</p>
                  </div>
                </div>

                <form onSubmit={handleSaveNotifications} className="space-y-4 pt-1">
                  {/* Switch 1: Notificaciones en la Web (Navbar) */}
                  <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-amber-400" />{t('notifications.webNotifications')}</div>
                      <p className="text-xs text-[var(--text-secondary)]">{t('notifications.webNotificationsDesc')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWebNotifications(!webNotifications)}
                      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 cursor-pointer ${
                        webNotifications ? 'bg-amber-500' : 'bg-zinc-600'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          webNotifications ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Switch 2: Notificaciones por Discord (DM) */}
                  <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-[#5865F2]" />{t('notifications.discordAlertsTitle')}</div>
                      <p className="text-xs text-[var(--text-secondary)]">{t('notifications.discordAlertsDescription')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDiscordNotifications(!discordNotifications)}
                      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 cursor-pointer ${
                        discordNotifications ? 'bg-[#5865F2]' : 'bg-zinc-600'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          discordNotifications ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Switch 3: Alertas por Correo */}
                  <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-purple-400" />{t('notifications.criticalEmailAlerts')}</div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {t('notifications.criticalEmailDesc', { email: userProfile?.email || '' })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEmailErrorAlerts(!emailErrorAlerts)}
                      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 cursor-pointer ${
                        emailErrorAlerts ? 'bg-purple-600' : 'bg-zinc-600'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          emailErrorAlerts ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={savingNotifications}
                    className="btn-primary mt-2 ml-auto"
                  >
                    {savingNotifications ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{t('notifications.savePreferences')}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* COLUMNA DERECHA: ESTADO & TEST DE DISCORD (5 COLS) */}
            <div className="lg:col-span-5 space-y-6">
              {/* DISCORD STATUS & TEST */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] font-heading">
                  <MessageSquare className="w-4 h-4 text-[#5865F2]" />
                  <span>{t('notifications.discordBotIntegration')}</span>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('notifications.discordBotDesc')}</p>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[var(--text-primary)] block">{t('notifications.notificationBot')}</span>
                      <span className="text-[10.5px] text-[var(--text-muted)] font-mono">Chii</span>
                    </div>
                    <span className="badge-status-success font-mono uppercase">{t('notifications.connectedBadge')}</span>
                  </div>

                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[var(--text-primary)] block">{t('notifications.yourDiscordAccount')}</span>
                      <span className="text-[10.5px] text-[var(--text-muted)] font-mono">
                        {userProfile?.discordId ? `ID: ${userProfile.discordId}` : t('notifications.notLinked')}
                      </span>
                    </div>
                    <span className={userProfile?.discordId ? 'badge-pill font-mono text-[10.5px] text-emerald-400' : 'badge-pill font-mono text-[10.5px] text-amber-400'}>
                      {userProfile?.discordId ? t('notifications.linkedBadge') : t('notifications.pendingBadge')}
                    </span>
                  </div>
                </div>

                {/* Botón para enviar prueba a Discord */}
                <button
                  type="button"
                  onClick={handleTestDiscord}
                  disabled={sendingDiscordTest || !userProfile?.discordId}
                  className="btn-secondary text-xs text-[#5865F2] hover:bg-[#5865F2]/10"
                  title={t('notifications.testDiscord')}
                >
                  {sendingDiscordTest ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{t('notifications.testDiscord')}</span>
                </button>
              </div>

              {/* ESTADO GENERAL */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] font-heading">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{t('notifications.engineStatus')}</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">{t('notifications.webNotificationCentre')}</span>
                    <span className="text-emerald-400 font-mono font-semibold">{t('notifications.active')}</span>
                  </div>
                  <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">Discord Direct Messages (DM)</span>
                    <span className="text-emerald-400 font-mono font-semibold">{t('notifications.active')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && <HistorialNotificaciones esAdmin={userProfile?.role === 'ADMIN'} />}
      </main>
    </div>
  );
}
