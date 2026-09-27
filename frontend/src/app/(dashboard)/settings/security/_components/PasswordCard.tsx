'use client';

import React from 'react';
import {
  Key,
  Lock,
  Loader2,
  Save,
} from 'lucide-react';

interface PasswordCardProps {
  handleSavePassword: (e: React.FormEvent) => void;
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  savingPassword: boolean;
  t: (key: string, values?: any) => string;
}

export function PasswordCard({
  handleSavePassword,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  savingPassword,
  t,
}: PasswordCardProps) {
  return (
    <>
      {/* CARD 1: CAMBIO DE CONTRASEÑA */}
      <div className="glass-card p-6 sm:p-7 space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('security.passwordSection')}</h2>
            <p className="text-xs text-[var(--text-secondary)]">{t('security.updatePasswordDesc')}</p>
          </div>
        </div>

        <form onSubmit={handleSavePassword} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> {t('security.currentPassword')}
            </label>
            <input
              type="password"
              suppressHydrationWarning
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              className="glass-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('security.newPassword')}</label>
              <input
                type="password"
                suppressHydrationWarning
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('security.minSixChars')}
                className="glass-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('security.confirmPassword')}</label>
              <input
                type="password"
                suppressHydrationWarning
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.repeatNewPasswordPlaceholder')}
                className="glass-input"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPassword || !currentPassword || !newPassword}
            className="btn-primary w-full py-2.5"
          >
            {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{t('security.updatePassword')}</span>
          </button>
        </form>
      </div>
    </>
  );
}
