import React from 'react';
import { Search } from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { useI18n } from '@/i18n/I18nProvider';
import { CATEGORY_LABELS } from './constants';

interface AdminTicketsFiltersProps {
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  search: string;
  setSearch: (search: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedPriority: string;
  setSelectedPriority: (priority: string) => void;
}

export function AdminTicketsFilters({
  selectedStatus,
  setSelectedStatus,
  setPage,
  search,
  setSearch,
  selectedCategory,
  setSelectedCategory,
  selectedPriority,
  setSelectedPriority,
}: AdminTicketsFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
        {[
          { key: 'ALL', label: 'Todos' },
          { key: 'OPEN', label: 'Abiertos' },
          { key: 'WAITING_USER', label: 'Esperando Usuario' },
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

      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* Buscador */}
        <div className="relative flex-1 sm:w-64 min-w-[200px]">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('admin.searchTicketsPlaceholder')}
            className="w-full h-9 pl-9 pr-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#FF634A] outline-none"
          />
        </div>

        {/* Categoría */}
        <div className="w-48 shrink-0">
          <CustomSelect
            value={selectedCategory}
            onChange={(val) => {
              setSelectedCategory(val);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: t('admin.categoryAll') },
              ...Object.entries(CATEGORY_LABELS).map(([key, val]) => ({
                value: key,
                label: val,
              })),
            ]}
            accentColor="cinnabar"
          />
        </div>

        {/* Prioridad */}
        <div className="w-40 shrink-0">
          <CustomSelect
            value={selectedPriority}
            onChange={(val) => {
              setSelectedPriority(val);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: t('admin.priorityAll') },
              { value: 'LOW', label: 'Baja' },
              { value: 'NORMAL', label: 'Normal' },
              { value: 'HIGH', label: 'Alta' },
              { value: 'URGENT', label: 'Urgente' },
            ]}
            accentColor="cinnabar"
          />
        </div>
      </div>
    </div>
  );
}
