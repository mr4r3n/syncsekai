'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { useI18n } from '@/i18n/I18nProvider';
import { CATEGORY_LABELS } from './constants';

interface TicketsFiltersProps {
  selectedStatus: string;
  setSelectedStatus: (val: string) => void;
  setPage: (updater: any) => void;
  search: string;
  setSearch: (val: string) => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
}

export function TicketsFilters({
  selectedStatus,
  setSelectedStatus,
  setPage,
  search,
  setSearch,
  selectedCategory,
  setSelectedCategory,
}: TicketsFiltersProps) {
  const { t } = useI18n();

  return (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
          {/* Selector de Estados */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { key: 'ALL', label: 'Todos' },
              { key: 'OPEN', label: 'Abiertos' },
              { key: 'WAITING_USER', label: t('tickets.withReply') },
              { key: 'IN_PROGRESS', label: t('tickets.underReview') },
              { key: 'RESOLVED', label: 'Resueltos' },
              { key: 'CLOSED', label: 'Cerrados' },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => {
                  setSelectedStatus(st.key);
                  setPage(1);
                }}
                className={`h-9 px-3.5 rounded-[6px] text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                  selectedStatus === st.key
                    ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold'
                    : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
                }`}
              >
                {t(st.label)}
              </button>
            ))}
          </div>

          {/* Buscador de Asunto o # de Ticket */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t('tickets.searchPlaceholderTickets')}
                className="w-full h-9 pl-9 pr-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#FF634A] outline-none"
              />
            </div>

            {/* Filtro de Categoría */}
            <div className="w-48 shrink-0">
              <CustomSelect
                value={selectedCategory}
                onChange={(val) => {
                  setSelectedCategory(val);
                  setPage(1);
                }}
                options={[
                  { value: 'ALL', label: t('tickets.allCategories') },
                  ...Object.entries(CATEGORY_LABELS).map(([key, val]) => ({
                    value: key,
                    label: t(val.label),
                  })),
                ]}
                accentColor="cinnabar"
              />
            </div>
          </div>
        </div>
  );
}
