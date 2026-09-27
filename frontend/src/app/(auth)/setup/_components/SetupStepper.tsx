'use client';

import React from 'react';
import { Globe, Mail, Key, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface SetupStepperProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
}

export function SetupStepper({
  currentStep,
  setCurrentStep,
}: SetupStepperProps) {
  const { t } = useI18n();

  const steps = [
    { id: 1, label: 'Dominio & Red', icon: Globe },
    { id: 2, label: t('setup.smtpServer'), icon: Mail },
    { id: 3, label: 'APIs & Conectores', icon: Key },
    { id: 4, label: 'SuperAdmin', icon: ShieldCheck },
  ];

  return (
      <div className="max-w-2xl mx-auto w-full my-6">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;
            return (
              <div
                key={s.id}
                onClick={() => {
                  if (isCompleted) setCurrentStep(s.id);
                }}
                className={`p-3 rounded-[6px] border flex flex-col items-center gap-1.5 transition-all select-none ${
                  isCurrent
                    ? 'border-[var(--accent-primary)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] shadow-sm'
                    : isCompleted
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400 cursor-pointer'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-bold hidden sm:inline">{s.label}</span>
                </div>
                <span className="text-[10px] font-mono sm:hidden">Paso {s.id}</span>
              </div>
            );
          })}
        </div>
      </div>
  );
}
