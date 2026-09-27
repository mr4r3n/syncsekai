'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import type { MonthRecord } from './tipos';
import { getMonthStartDayOffset, etiquetaMes, formatDateReadable } from './utils';

interface DatePickerProps {
  currentDate: string;
  minDate: string;
  maxDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  title: string;
  isLightMode: boolean;
  availableMonths?: MonthRecord[];
}

function DatePickerPopover({
  currentDate,
  minDate,
  maxDate,
  onSelect,
  onClose,
  title,
  isLightMode,
  availableMonths = [],
}: DatePickerProps) {
  const { t, locale } = useI18n();
  const [currY, currM] = currentDate ? currentDate.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const monthsList = availableMonths && availableMonths.length > 0
    ? availableMonths
    : [{ year: currY, month: currM - 1, totalScrobbles: 0, daysCount: 30, firstActiveDay: 1, days: [] }];

  const [pickerMonthIndex, setPickerMonthIndex] = useState(() => {
    const idx = monthsList.findIndex((m) => m.year === currY && m.month === currM - 1);
    return idx >= 0 ? idx : Math.max(0, monthsList.length - 1);
  });

  const monthInfo = monthsList[pickerMonthIndex] || monthsList[0];
  const paddingSlots = getMonthStartDayOffset(monthInfo.year, monthInfo.month);
  const canGoPrev = pickerMonthIndex > 0;
  const canGoNext = pickerMonthIndex < monthsList.length - 1;

  const handleDayClick = (day: number) => {
    const mStr = String(monthInfo.month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateStr = `${monthInfo.year}-${mStr}-${dStr}`;
    onSelect(dateStr);
    onClose();
  };

  return (
    <div
      className={`absolute top-full left-0 mt-2 z-50 w-68 sm:w-72 p-3.5 rounded-[8px] border shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 space-y-3 text-left ${
        isLightMode
          ? 'bg-white border-zinc-200 text-zinc-900 shadow-zinc-400/30'
          : 'bg-[#222225] border-zinc-700 text-zinc-100 shadow-black/70'
      }`}
    >
      {/* Cabecera con selector de mes */}
      <div
        className={`flex items-center justify-between border-b pb-2 ${
          isLightMode ? 'border-zinc-200' : 'border-zinc-700'
        }`}
      >
        <button
          type="button"
          onClick={() => setPickerMonthIndex((prev) => Math.max(0, prev - 1))}
          disabled={!canGoPrev}
          className={`w-7 h-7 rounded-[4px] border flex items-center justify-center transition-all cursor-pointer ${
            isLightMode
              ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900'
              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-white'
          } disabled:opacity-20 disabled:cursor-not-allowed`}
          title={canGoPrev ? t('history.previousMonth') : 'Primer mes alcanzado'}
        >
          <ChevronLeft className={`w-4 h-4 shrink-0 ${isLightMode ? 'text-zinc-900' : 'text-white'}`} />
        </button>

        <span
          className={`text-xs font-bold font-heading ${
            isLightMode ? 'text-zinc-900' : 'text-white'
          }`}
        >
          {etiquetaMes(monthInfo.year, monthInfo.month, locale)}
        </span>

        <button
          type="button"
          onClick={() =>
            setPickerMonthIndex((prev) => Math.min(monthsList.length - 1, prev + 1))
          }
          disabled={!canGoNext}
          className={`w-7 h-7 rounded-[4px] border flex items-center justify-center transition-all cursor-pointer ${
            isLightMode
              ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900'
              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-white'
          } disabled:opacity-20 disabled:cursor-not-allowed`}
          title={canGoNext ? t('history.nextMonth') : t('history.currentMonthNoFuture')}
        >
          <ChevronRight className={`w-4 h-4 shrink-0 ${isLightMode ? 'text-zinc-900' : 'text-white'}`} />
        </button>
      </div>

      {/* Cabeceras de días de semana */}
      <div
        className={`grid grid-cols-7 text-center text-[10px] font-mono font-bold ${
          isLightMode ? 'text-zinc-600' : 'text-zinc-400'
        }`}
      >
        <span>LU</span>
        <span>MA</span>
        <span>MI</span>
        <span>JU</span>
        <span>VI</span>
        <span>SA</span>
        <span>DO</span>
      </div>

      {/* Rejilla de días */}
      <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
        {Array.from({ length: paddingSlots }).map((_, idx) => (
          <div key={`pad-${idx}`} className="h-7" />
        ))}

        {Array.from({ length: monthInfo.daysCount }).map((_, idx) => {
          const day = idx + 1;
          const mStr = String(monthInfo.month + 1).padStart(2, '0');
          const dStr = String(day).padStart(2, '0');
          const dateStr = `${monthInfo.year}-${mStr}-${dStr}`;

          const isBeforeMin = dateStr < minDate;
          const isAfterMax = dateStr > maxDate;
          const isDisabled = isBeforeMin || isAfterMax;
          const isSelected = dateStr === currentDate;

          let dayStyle = '';
          if (isSelected) {
            dayStyle = 'bg-[#FF634A] text-white font-bold shadow-xs';
          } else if (isDisabled) {
            dayStyle = `opacity-25 cursor-not-allowed border border-dashed ${
              isLightMode ? 'border-zinc-300 text-zinc-400' : 'border-zinc-700 text-zinc-500'
            }`;
          } else {
            dayStyle = isLightMode
              ? 'text-zinc-900 hover:bg-zinc-100 font-semibold'
              : 'text-zinc-100 hover:bg-zinc-800 font-medium';
          }

          return (
            <button
              key={day}
              type="button"
              disabled={isDisabled}
              onClick={() => handleDayClick(day)}
              className={`h-7 w-7 mx-auto rounded-[4px] flex items-center justify-center transition-all cursor-pointer ${dayStyle}`}
              title={
                isBeforeMin
                  ? 'Fecha bloqueada: Sin registros de historial (mín: 15/01/2026)'
                  : isAfterMax
                  ? 'Fecha futura'
                  : dateStr
              }
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Pie con advertencia de bloqueo y botón de cerrar */}
      <div
        className={`flex items-center justify-between pt-2 border-t text-[10.5px] font-mono ${
          isLightMode ? 'border-zinc-200' : 'border-zinc-700'
        }`}
      >
        <span
          className={`flex items-center gap-1 ${
            isLightMode ? 'text-zinc-600' : 'text-zinc-400'
          }`}
        >
          <Lock className={`w-3 h-3 ${isLightMode ? 'text-amber-700' : 'text-amber-400'}`} />
          <span>Límite: {formatDateReadable(minDate)} - {formatDateReadable(maxDate)}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className={`text-xs px-2 py-0.5 rounded-[4px] border font-semibold cursor-pointer transition-colors ${
            isLightMode
              ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900'
              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-white'
          }`}
        >{t('common.close')}</button>
      </div>
    </div>
  );
}

export { DatePickerPopover };
export type { DatePickerProps };
