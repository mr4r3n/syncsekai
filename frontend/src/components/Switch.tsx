'use client';

import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  id,
  ariaLabel,
  size = 'md',
}: SwitchProps) {
  const isSm = size === 'sm';

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  const trackWidth = isSm ? 'w-8 h-4' : 'w-10 h-5';
  const thumbSize = isSm ? 'w-3 h-3' : 'w-4 h-4';
  const translateDistance = isSm ? 'translate-x-4' : 'translate-x-5';

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`relative inline-flex ${trackWidth} shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-app)] select-none disabled:opacity-40 disabled:cursor-not-allowed ${
        checked
          ? 'bg-[var(--accent-primary)]'
          : 'bg-[var(--text-muted)]/35'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block ${thumbSize} transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
          checked ? translateDistance : 'translate-x-0.5'
        } my-auto`}
      />
    </button>
  );
}
