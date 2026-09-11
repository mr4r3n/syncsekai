'use client';

import { useState } from 'react';

interface CountryFlagProps {
  code?: string;
  countryName?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function getCountryFlagEmoji(countryCode?: string): string {
  if (!countryCode || countryCode === 'LAN' || countryCode === 'LOC' || countryCode === 'XX' || countryCode.length !== 2) {
    return '🌐';
  }
  const code = countryCode.toUpperCase();
  const offset = 127397;
  try {
    return String.fromCodePoint(...code.split('').map((c) => c.charCodeAt(0) + offset));
  } catch {
    return '🌐';
  }
}

export function CountryFlag({
  code = 'XX',
  countryName = '',
  className = '',
  size = 'md',
}: CountryFlagProps) {
  const [imgError, setImgError] = useState(false);
  const cleanCode = (code || 'XX').trim().toUpperCase();

  const isLocalOrUnknown =
    !cleanCode ||
    cleanCode === 'XX' ||
    cleanCode === 'LOC' ||
    cleanCode === 'LAN' ||
    cleanCode.length !== 2;

  const sizeClasses = {
    sm: 'w-4 h-3 text-[11px]',
    md: 'w-5 h-3.5 text-xs',
    lg: 'w-6 h-4 text-sm',
  };

  if (isLocalOrUnknown) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 text-[var(--text-muted)] ${className}`}
        title={countryName || 'Red Local / Desconocido'}
      >
        🌐
      </span>
    );
  }

  if (imgError) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 font-emoji ${className}`}
        title={countryName || cleanCode}
      >
        {getCountryFlagEmoji(cleanCode)}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${cleanCode.toLowerCase()}.png`}
      alt={countryName || cleanCode}
      onError={() => setImgError(true)}
      loading="lazy"
      className={`inline-block object-cover rounded-[2px] shadow-sm border border-white/10 shrink-0 select-none ${sizeClasses[size]} ${className}`}
      title={countryName || cleanCode}
    />
  );
}
