'use client';

import React, { useState, useRef } from 'react';
import {
  Key,
  Lock,
  Loader2,
  Save,
  Pencil,
  X,
} from 'lucide-react';

interface PasswordCardProps {
  handleSavePassword: (e: React.FormEvent) => Promise<boolean | void> | boolean | void;
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  savingPassword: boolean;
  /** Accounts created with Google or Discord have none yet: no current password to ask for. */
  hasPassword: boolean;
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
  hasPassword,
  t,
}: PasswordCardProps) {
  const [editing, setEditing] = useState(false);
  const currentPasswordRef = useRef<HTMLInputElement>(null);

  const handleStartEditing = () => {
    setEditing(true);
    setTimeout(() => {
      currentPasswordRef.current?.focus();
    }, 50);
  };

  const handleCancel = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setEditing(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await handleSavePassword(e);
    if (success !== false) {
      setEditing(false);
    }
  };

  return (
    <>
      {/* CARD 1: PASSWORD CHANGE */}
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

        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          <fieldset disabled={!editing} className="contents">
            {hasPassword && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> {t('security.currentPassword')}
                </label>
                <input
                  ref={currentPasswordRef}
                  type="password"
                  suppressHydrationWarning
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="glass-input"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('security.newPassword')}</label>
                <input
                  type="password"
                  suppressHydrationWarning
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('security.minTwelveChars')}
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
          </fieldset>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-6">
            {!editing ? (
              <button
                type="button"
                onClick={handleStartEditing}
                className="btn-secondary w-full sm:w-auto px-4 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t('common.edit')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancel}
                disabled={savingPassword}
                className="btn-secondary w-full sm:w-auto px-4 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('common.cancel')}</span>
              </button>
            )}
            <button
              type="submit"
              disabled={!editing || savingPassword || (hasPassword && !currentPassword) || !newPassword}
              className="btn-primary w-full sm:w-auto px-4 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{t('security.updatePassword')}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
