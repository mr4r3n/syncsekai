import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface AccountStatusCardProps {
  userProfile: any;
  t: (key: string, params?: any) => string;
}

export function AccountStatusCard({ userProfile, t }: AccountStatusCardProps) {
  return (
    <div className="glass-card p-6 space-y-4">
      {/* CARD COMPLEMENTARIO: IDENTIDAD & ROL */}
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
  );
}
