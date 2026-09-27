'use client';

import React from 'react';
import { AnnouncementData } from '@/components/AnnouncementBanner';
import { CustomSelect } from '@/components/CustomSelect';

interface RulesTabProps {
  activeTab: string;
  formData: AnnouncementData;
  setFormData: React.Dispatch<React.SetStateAction<AnnouncementData>>;
  t: (key: string, values?: any) => string;
}

export function RulesTab({
  activeTab,
  formData,
  setFormData,
  t,
}: RulesTabProps) {
  return (
    <>
            {/* TAB 5: AUDIENCIA & CIERRE */}
            {activeTab === 'rules' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Audiencia Objetivo */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                      Audiencia Objetivo
                    </label>
                    <CustomSelect
                      value={formData.targetAudience || 'ALL'}
                      onChange={(val) => setFormData({ ...formData, targetAudience: val })}
                      options={[
                        { value: 'ALL', label: t('announcements.audienceAll') },
                        { value: 'AUTHENTICATED', label: t('announcements.audienceRegistered') },
                        { value: 'GUEST', label: t('announcements.audienceGuests') },
                        { value: 'ADMIN_ONLY', label: t('announcements.audienceAdmins') },
                      ]}
                      accentColor="cinnabar"
                      triggerClassName="h-10 sm:h-11"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">{t('announcements.audienceDesc')}</p>
                  </div>

                  {/* Allow Dismissal & Expiration */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.dismissBehaviour')}</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs sm:text-sm font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isClosable !== false}
                          onChange={(e) => setFormData({ ...formData, isClosable: e.target.checked })}
                          className="w-4 h-4 rounded text-[#FF634A]"
                        />
                        <span>{t('announcements.allowUsersToClose')}</span>
                      </label>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <span className="text-xs sm:text-sm text-[var(--text-secondary)]">{t('announcements.rememberDismissalFor')}</span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={formData.dismissExpiryDays || 7}
                        onChange={(e) =>
                          setFormData({ ...formData, dismissExpiryDays: parseInt(e.target.value, 10) || 7 })
                        }
                        className="w-24 h-10 px-3 text-center rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs sm:text-sm text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                      />
                      <span className="text-xs sm:text-sm text-[var(--text-muted)]">{t('announcements.days')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
    </>
  );
}
