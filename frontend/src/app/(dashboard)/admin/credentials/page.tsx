'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, Mail, Save, Trash2 } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { api } from '@/lib/api';

interface Credencial {
  key: string;
  group: string;
  label: string;
  isSecret: boolean;
  configured: boolean;
  value: string | null;
  updatedAt: string | null;
}

/**
 * Los grupos, en el orden en que se pintan. La pista es la ruta dentro de la
 * consola del proveedor —o el prefijo de la variable de entorno— y no se
 * traduce: esos menús se llaman igual en cualquier idioma.
 *
 * `logo` es el SVG de `public/`, el mismo fichero que ya usan conexiones y el
 * inicio de sesión. SMTP no es una marca y no tiene: ahí va un icono de lucide.
 */
/**
 * Ancho de cada campo en la rejilla de seis columnas de su tarjeta. Un puerto
 * no necesita el ancho entero; un client id y su secret caben en una fila.
 * Lo que no esté aquí ocupa la fila completa.
 */
const COLUMNAS: Record<string, string> = {
  SMTP_HOST: 'sm:col-span-4',
  SMTP_PORT: 'sm:col-span-2',
  SMTP_USER: 'sm:col-span-3',
  SMTP_PASS: 'sm:col-span-3',
  GOOGLE_CLIENT_ID: 'sm:col-span-3',
  GOOGLE_CLIENT_SECRET: 'sm:col-span-3',
  DISCORD_CLIENT_ID: 'sm:col-span-3',
  DISCORD_CLIENT_SECRET: 'sm:col-span-3',
  ANILIST_CLIENT_ID: 'sm:col-span-3',
  ANILIST_CLIENT_SECRET: 'sm:col-span-3',
  MAL_CLIENT_ID: 'sm:col-span-3',
  MAL_CLIENT_SECRET: 'sm:col-span-3',
};

const GRUPOS: Array<{ id: string; nombre: string; pista: string; logo?: string }> = [
  { id: 'google', nombre: 'Google', logo: '/google.svg', pista: 'Cloud Console → Credentials → OAuth client' },
  { id: 'discord', nombre: 'Discord', logo: '/social/discord.svg', pista: 'Developer Portal → OAuth2 · Bot' },
  { id: 'anilist', nombre: 'AniList', logo: '/anilist.svg', pista: 'Settings → Developer → Create New Client' },
  { id: 'mal', nombre: 'MyAnimeList', logo: '/mal.svg', pista: 'API → Create ID (PKCE)' },
  { id: 'smtp', nombre: 'SMTP', pista: 'SMTP_*' },
  { id: 'plex', nombre: 'Plex', logo: '/plex.svg', pista: 'PLEX_CLIENT_ID' },
];

export default function CredencialesPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t, locale } = useI18n();

  const [credenciales, setCredenciales] = useState<Credencial[]>([]);
  const [cargando, setCargando] = useState(true);
  /*
   * Sólo lo que se ha tocado. Un campo que no se toca no se manda: mandar todo
   * reescribiría credenciales que están bien, y bastaría un fallo de red a medio
   * guardar para dejar la instalación sin poder iniciar sesión con nadie.
   */
  const [cambios, setCambios] = useState<Record<string, string>>({});
  const [pidiendoClave, setPidiendoClave] = useState(false);
  const [clave, setClave] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      setCargando(true);
      const yo = await api.auth.me().catch(() => null);
      const usuario = (yo as any)?.user || yo;
      if (!usuario || usuario.role !== 'ADMIN') {
        showToast(t('admin.adminRequired'), 'error');
        router.push('/catalog');
        return;
      }
      const res = await api.admin.getCredentials();
      setCredenciales(res.credentials || []);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const numeroDeCambios = Object.keys(cambios).length;

  const guardar = async () => {
    try {
      setGuardando(true);
      const res = await api.admin.updateCredentials(clave, cambios);
      showToast(`${t('credentials.saved')} (${res.updated.length})`, 'success');
      setCambios({});
      setClave('');
      setPidiendoClave(false);
      await cargar();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const fecha = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB') : '';

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('credentials.title')} />

      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold tracking-tight font-heading">
                {t('credentials.title')}
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{t('credentials.subtitle')}</p>
          </div>

          <button
            type="button"
            onClick={() => setPidiendoClave(true)}
            disabled={numeroDeCambios === 0 || cargando}
            className="btn-primary shrink-0 w-full sm:w-auto justify-center disabled:opacity-40 disabled:cursor-default"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {t('credentials.save')}
              {numeroDeCambios > 0 ? ` (${numeroDeCambios})` : ''}
            </span>
          </button>
        </div>
      </div>

      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-6 min-w-0">
        <p className="text-[11px] font-mono text-[var(--text-muted)]">
          {t('credentials.restartHint')}
        </p>

        {cargando ? (
          <div className="py-24 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {GRUPOS.map((grupo) => {
              const delGrupo = credenciales.filter((c) => c.group === grupo.id);
              if (delGrupo.length === 0) return null;

              return (
                <section key={grupo.id} className="glass-card p-5 sm:p-6 space-y-4">
                  <div className="pb-3 border-b border-[var(--glass-border)] flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                      {grupo.logo ? (
                        <img
                          src={grupo.logo}
                          alt=""
                          aria-hidden="true"
                          width={20}
                          height={20}
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Mail className="w-4 h-4 text-[var(--text-secondary)]" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold font-heading">{grupo.nombre}</h2>
                      <p className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5 truncate">
                        {grupo.pista}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-x-4 gap-y-4">
                    {delGrupo.map((cred) => (
                      <div key={cred.key} className={`space-y-1.5 min-w-0 ${COLUMNAS[cred.key] || 'sm:col-span-6'}`}>
                        <label
                          htmlFor={`cred-${cred.key}`}
                          className="block text-xs font-medium text-[var(--text-secondary)]"
                        >
                          {cred.label}
                        </label>

                        <div className="flex items-center gap-2">
                          <input
                            id={`cred-${cred.key}`}
                            type={cred.isSecret ? 'password' : 'text'}
                            autoComplete="off"
                            suppressHydrationWarning
                            value={cambios[cred.key] ?? cred.value ?? ''}
                            onChange={(e) =>
                              setCambios((prev) => ({ ...prev, [cred.key]: e.target.value }))
                            }
                            placeholder={
                              cred.isSecret && cred.configured
                                ? t('credentials.secretHidden')
                                : t('credentials.leaveBlank')
                            }
                            className="glass-input text-xs font-mono min-w-0 flex-1"
                          />
                          {cred.configured && (
                            <button
                              type="button"
                              onClick={() => setCambios((prev) => ({ ...prev, [cred.key]: '' }))}
                              title={t('credentials.clear')}
                              aria-label={`${t('credentials.clear')} — ${cred.label}`}
                              className="btn-icon-sm shrink-0 hover:text-[var(--status-danger)]"
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          )}
                        </div>

                        {/*
                          El estado va en esta línea y no en una pastilla aparte:
                          es la misma información —si está puesta y desde cuándo—
                          y repartida en dos sitios obligaba a mirar dos veces.
                          El color no va solo: sin configurar lo dice el texto,
                          que es lo que lee quien no distingue el verde del rojo.
                        */}
                        <p
                          className={`text-[10.5px] font-mono ${
                            cred.configured
                              ? 'text-[var(--status-success)]'
                              : 'text-[var(--status-danger)]'
                          }`}
                        >
                          {cred.configured
                            ? cred.updatedAt
                              ? t('credentials.changedOn', { fecha: fecha(cred.updatedAt) })
                              : t('credentials.configured')
                            : t('credentials.notConfigured')}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Volver a pedir la contraseña: rotar estas claves afecta a todas las
          cuentas, y se hace dos veces al año. Una sesión robada no debería
          bastar para tocarlas. */}
      <ConfirmModal
        isOpen={pidiendoClave}
        title={t('credentials.confirmTitle')}
        description={t('credentials.confirmDesc', { n: numeroDeCambios })}
        confirmText={t('credentials.save')}
        cancelText={t('common.cancel')}
        variant="warning"
        loading={guardando}
        onConfirm={guardar}
        onClose={() => {
          setPidiendoClave(false);
          setClave('');
        }}
      >
        <input
          type="password"
          autoComplete="current-password"
          suppressHydrationWarning
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder={t('credentials.yourPassword')}
          className="glass-input text-xs"
        />
      </ConfirmModal>
    </div>
  );
}
