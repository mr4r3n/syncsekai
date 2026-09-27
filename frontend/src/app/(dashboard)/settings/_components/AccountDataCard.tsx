import React from 'react';
import { User, Clock, CheckCircle2, Mail, Loader2, Save } from 'lucide-react';

interface AccountDataCardProps {
  handleSaveAccount: (e: React.FormEvent) => void;
  username: string;
  setUsername: (username: string) => void;
  daysRemaining: number | null;
  email: string;
  setEmail: (email: string) => void;
  accountPassword: string;
  setAccountPassword: (accountPassword: string) => void;
  userProfile: any;
  savingAccount: boolean;
  t: (key: string, params?: any) => string;
}

export function AccountDataCard({
  handleSaveAccount,
  username,
  setUsername,
  daysRemaining,
  email,
  setEmail,
  accountPassword,
  setAccountPassword,
  userProfile,
  savingAccount,
  t,
}: AccountDataCardProps) {
  return (
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
  );
}
