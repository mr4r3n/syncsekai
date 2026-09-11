'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface ActiveThemeEffect {
  effectType: string;
  isEnabled: boolean;
  isChristmas: boolean;
  isAutumn: boolean;
  isHalloween: boolean;
  isValentine: boolean;
  isNewYear: boolean;
  isCyber: boolean;
}

export function useActiveThemeEffect(): ActiveThemeEffect {
  const [effectType, setEffectType] = useState<string>('NONE');
  const [isEnabled, setIsEnabled] = useState<boolean>(false);

  const checkActive = useCallback(() => {
    api.announcements
      .getActive()
      .then((res: any) => {
        if (res && res.id && res.enableGlobalAtmosphere !== false) {
          setEffectType(res.effectType || 'NONE');
          setIsEnabled(true);
        } else {
          setEffectType('NONE');
          setIsEnabled(false);
        }
      })
      .catch(() => {
        setEffectType('NONE');
        setIsEnabled(false);
      });
  }, []);

  useEffect(() => {
    checkActive();

    const handleUpdate = (e: any) => {
      const data = e.detail;
      if (data && data.isActive !== false && data.enableGlobalAtmosphere !== false) {
        setEffectType(data.effectType || 'NONE');
        setIsEnabled(true);
      } else if (data && data.isActive === false) {
        setEffectType('NONE');
        setIsEnabled(false);
      } else {
        checkActive();
      }
    };

    window.addEventListener('plexsync:announcement-updated', handleUpdate);
    const interval = setInterval(checkActive, 15000);

    return () => {
      window.removeEventListener('plexsync:announcement-updated', handleUpdate);
      clearInterval(interval);
    };
  }, [checkActive]);

  return {
    effectType,
    isEnabled,
    isChristmas: isEnabled && (effectType === 'SNOWFLAKES' || effectType === 'CHRISTMAS'),
    isAutumn: isEnabled && (effectType === 'AUTUMN_LEAVES' || effectType === 'AUTUMN'),
    isHalloween: isEnabled && (effectType === 'SPOOKY_BATS' || effectType === 'HALLOWEEN'),
    isValentine: isEnabled && (effectType === 'FLOATING_HEARTS' || effectType === 'VALENTINE'),
    isNewYear: isEnabled && (effectType === 'CONFETTI' || effectType === 'NEW_YEAR'),
    isCyber: isEnabled && (effectType === 'CYBER_GLOW' || effectType === 'CYBER_NEON'),
  };
}
