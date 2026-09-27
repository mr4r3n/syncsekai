'use client';

import React from 'react';
import {
  Type,
  Palette,
  Image as ImageIcon,
  Calendar,
  Users,
} from 'lucide-react';

interface StudioTabBarProps {
  activeTab: 'content' | 'visuals' | 'media' | 'schedule' | 'rules';
  setActiveTab: (tab: 'content' | 'visuals' | 'media' | 'schedule' | 'rules') => void;
  t: (key: string, values?: any) => string;
}

export function StudioTabBar({
  activeTab,
  setActiveTab,
  t,
}: StudioTabBarProps) {
  return (
    <>
          {/* Tab Navigation: Generously sized outline-style buttons */}
          <div className="flex items-center gap-2.5 p-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`h-10 sm:h-11 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-semibold transition-all flex items-center gap-2.5 cursor-pointer border shrink-0 ${
                activeTab === 'content'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <Type className="w-4 h-4" />
              <span>{t('announcements.contentSection')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('visuals')}
              className={`h-10 sm:h-11 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-semibold transition-all flex items-center gap-2.5 cursor-pointer border shrink-0 ${
                activeTab === 'visuals'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>{t('announcements.visualsSection')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('media')}
              className={`h-10 sm:h-11 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-semibold transition-all flex items-center gap-2.5 cursor-pointer border shrink-0 ${
                activeTab === 'media'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>{t('announcements.mediaSection')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`h-10 sm:h-11 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-semibold transition-all flex items-center gap-2.5 cursor-pointer border shrink-0 ${
                activeTab === 'schedule'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>{t('announcements.scheduleSection')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`h-10 sm:h-11 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-semibold transition-all flex items-center gap-2.5 cursor-pointer border shrink-0 ${
                activeTab === 'rules'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{t('announcements.rulesSection')}</span>
            </button>
          </div>
    </>
  );
}
