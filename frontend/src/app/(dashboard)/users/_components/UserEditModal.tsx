import React from 'react';
import { Crown, X, Loader2, Save } from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { Switch } from '@/components/Switch';
import { USER_PERMISSIONS } from './constants';
import { getAvatarSrc } from './utils';

interface UserEditModalProps {
  editingUser: any | null;
  setEditingUser: (u: any | null) => void;
  editProps: any;
  editForm: any;
  setEditForm: React.Dispatch<React.SetStateAction<any>>;
  handleSaveEdit: (e: React.FormEvent) => void;
  isSaving: boolean;
  t: (key: string, params?: any) => string;
}

export function UserEditModal({
  editingUser,
  setEditingUser,
  editProps,
  editForm,
  setEditForm,
  handleSaveEdit,
  isSaving,
  t,
}: UserEditModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        {...editProps}
        /* On mobile this is a bottom sheet sliding up, not a floating
           dialog in the center: matches rest of site—options menu
           already did—and positions content near the thumb
           instead of mid-screen. */
        className="relative w-full sm:max-w-2xl rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-lg)] border-t sm:border border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] sm:bg-[var(--glass-bg)] shadow-[0_-12px_48px_rgba(0,0,0,0.6)] sm:shadow-[var(--glass-shadow-lg)] flex flex-col text-[var(--text-primary)] backdrop-blur-2xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 sm:duration-200 outline-none"
      >
        {/* Handle, matching options sheet */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-white/25" />
        </div>
        {/* Header.
            Avatar was an 80 px square consuming width, and next to
            title hung a pill with truncated ID, uncopyable and
            useless here: now lives in avatar title attribute
            in case ever needed. */}
        <div className="flex items-center gap-3.5 px-5 sm:px-6 py-4 border-b border-[var(--glass-border)] shrink-0">
          {getAvatarSrc(editingUser.avatarUrl) ? (
            <img
              src={getAvatarSrc(editingUser.avatarUrl)!}
              alt=""
              title={editingUser.id}
              className="w-11 h-11 rounded-[var(--radius-md)] object-cover border border-[var(--border-subtle)] shrink-0 bg-[var(--bg-app)]"
            />
          ) : (
            <div
              title={editingUser.id}
              className="w-11 h-11 rounded-[var(--radius-md)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold text-base shrink-0"
            >
              {editingUser.username?.[0]?.toUpperCase() || 'U'}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              {t('users.editingAccount')}
            </p>
            <h2 className="text-base font-bold font-heading leading-tight truncate flex items-center gap-1.5">
              <span className="truncate">@{editingUser.username}</span>
              {editingUser.role === 'ADMIN' && (
                <Crown
                  className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0"
                  aria-label={t('users.administrator')}
                />
              )}
            </h2>
            <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">
              {editingUser.email}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setEditingUser(null)}
            className="w-9 h-9 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-center cursor-pointer shrink-0"
            title={t('common.closeModal')}
            aria-label={t('common.closeModal')}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-5 sm:px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 items-start">
              {/* LEFT: account */}
              <div className="space-y-4">
                <h3 className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--text-muted)] pb-2 border-b border-[var(--glass-border)]">
                  {t('users.accountAndSecurity')}
                </h3>

                <div className="space-y-1.5">
                  <label htmlFor="usuario-nombre" className="text-xs font-medium text-[var(--text-secondary)]">
                    {t('users.username')}
                  </label>
                  <input
                    id="usuario-nombre"
                    type="text"
                    required
                    suppressHydrationWarning
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    placeholder={t('users.usernamePlaceholder')}
                    className="glass-input text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="usuario-correo" className="text-xs font-medium text-[var(--text-secondary)]">
                    {t('auth.emailLabel')}
                  </label>
                  <input
                    id="usuario-correo"
                    type="email"
                    required
                    suppressHydrationWarning
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder={t('auth.emailPlaceholder')}
                    className="glass-input text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    {t('users.accountRole')}
                  </label>
                  <CustomSelect
                    value={editForm.role}
                    onChange={(val) => setEditForm({ ...editForm, role: val })}
                    accentColor="cinnabar"
                    options={[
                      { value: 'USER', label: t('users.roleStandardUser'), badge: 'USER' },
                      { value: 'ADMIN', label: t('users.roleAdmin'), badge: 'ADMIN' },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="usuario-clave" className="text-xs font-medium text-[var(--text-secondary)]">
                    {t('users.newPasswordOptional')}
                  </label>
                  <input
                    id="usuario-clave"
                    type="password"
                    suppressHydrationWarning
                    placeholder={t('users.leaveBlankToKeep')}
                    value={editForm.newPassword}
                    onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                    className="glass-input text-xs"
                  />
                </div>
              </div>

              {/* RIGHT: access and permissions, using same switch as rest of site. */}
              <div className="space-y-4">
                <h3 className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--text-muted)] pb-2 border-b border-[var(--glass-border)]">
                  {t('users.accessAnd2fa')}
                </h3>

                <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
                  <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {t('users.blockAccessSuspend')}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {t('users.blockLoginAndSync')}
                      </div>
                    </div>
                    <Switch
                      checked={editForm.isSuspended}
                      onChange={(v) => setEditForm({ ...editForm, isSuspended: v })}
                      ariaLabel={t('users.blockAccessSuspend')}
                    />
                  </div>

                  {editingUser.twoFactorEnabled && (
                    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--text-primary)]">
                          {t('users.reset2fa')}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {t('users.reset2faDesc')}
                        </div>
                      </div>
                      <Switch
                        checked={editForm.reset2Fa}
                        onChange={(v) => setEditForm({ ...editForm, reset2Fa: v })}
                        ariaLabel={t('users.reset2faShort')}
                      />
                    </div>
                  )}
                </div>

                <h3 className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--text-muted)] pb-2 border-b border-[var(--glass-border)]">
                  {t('users.featurePermissions')}
                </h3>

                <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
                  {USER_PERMISSIONS.map(({ field, key }) => (
                    <div key={field} className="flex items-center justify-between gap-3 px-3.5 py-2">
                      <span className="text-xs text-[var(--text-secondary)] min-w-0 truncate">
                        {t(key)}
                      </span>
                      <Switch
                        checked={editForm[field]}
                        onChange={(v) => setEditForm({ ...editForm, [field]: v })}
                        ariaLabel={t(key)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-4 border-t border-[var(--glass-border)] shrink-0">
            <button type="button" onClick={() => setEditingUser(null)} className="btn-secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{isSaving ? t('users.saving') : t('users.saveChanges')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
