'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { FireworksCanvas } from './FireworksCanvas';

interface GlobalAtmosphereProps {
  previewEffectType?: string;
  previewEnabled?: boolean;
  isPreview?: boolean;
}

export function GlobalAtmosphere({
  previewEffectType,
  previewEnabled,
  isPreview = false,
}: GlobalAtmosphereProps) {
  const [activeEffect, setActiveEffect] = useState<string | null>(previewEffectType || null);
  const [isEnabled, setIsEnabled] = useState<boolean>(previewEnabled !== undefined ? previewEnabled : false);

  const fetchActive = useCallback(() => {
    if (isPreview) return;
    api.announcements
      .getActive()
      .then((res: any) => {
        if (res && res.id && res.enableGlobalAtmosphere !== false) {
          setActiveEffect(res.effectType || 'NONE');
          setIsEnabled(true);
        } else {
          setIsEnabled(false);
          setActiveEffect(null);
        }
      })
      .catch(() => {
        setIsEnabled(false);
      });
  }, [isPreview]);

  useEffect(() => {
    if (isPreview) {
      setActiveEffect(previewEffectType || null);
      setIsEnabled(Boolean(previewEnabled));
      return;
    }

    fetchActive();

    // Escuchar eventos en tiempo real disparados desde el Panel de Administración o Banner
    const handleUpdate = (e: any) => {
      const data = e.detail;
      if (data && (data.isActive !== false) && data.enableGlobalAtmosphere !== false) {
        setActiveEffect(data.effectType || 'NONE');
        setIsEnabled(true);
      } else if (data && data.isActive === false) {
        setIsEnabled(false);
        setActiveEffect(null);
      } else {
        fetchActive();
      }
    };

    window.addEventListener('plexsync:announcement-updated', handleUpdate);

    // Polling ligero cada 15s para sincronizar estado global
    const interval = setInterval(fetchActive, 15000);

    return () => {
      window.removeEventListener('plexsync:announcement-updated', handleUpdate);
      clearInterval(interval);
    };
  }, [isPreview, previewEffectType, previewEnabled, fetchActive]);

  // Generar partículas pre-calculadas para rendimiento óptimo
  const particles = useMemo(() => {
    return Array.from({ length: 22 }, (_, i) => ({
      id: i,
      left: `${(i * 4.5) + (Math.sin(i * 1.7) * 2.5)}%`,
      delay: `${(i * 0.35) % 5}s`,
      duration: `${4.5 + ((i % 5) * 1.2)}s`,
      size: `${14 + ((i * 3) % 12)}px`,
      opacity: 0.45 + ((i % 4) * 0.14),
      rotation: `${(i * 45) % 360}deg`,
    }));
  }, []);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  if (!isEnabled || !activeEffect || activeEffect === 'NONE' || prefersReducedMotion) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-30 select-none overflow-hidden"
    >
      {/* ===================================================================
          1. NAVIDAD & INVIERNO (SNOWFLAKES)
          =================================================================== */}
      {activeEffect === 'SNOWFLAKES' && (
        <>
          {/* Trineo de Santa Claus con Renos volando por el cielo */}
          <div className="fixed top-14 sm:top-16 left-0 w-full pointer-events-none overflow-hidden h-28 sm:h-32 z-40">
            <div className="absolute right-0 top-2 animate-flying-sleigh">
              <div className="relative">
                <svg
                  viewBox="0 0 320 65"
                  className="w-56 sm:w-72 h-auto text-amber-200/90 drop-shadow-[0_0_16px_rgba(255,215,0,0.8)]"
                  fill="currentColor"
                >
                  {/* Reno 1 (Rudolph con nariz roja brillante) */}
                  <g transform="translate(0, 12)">
                    <ellipse cx="22" cy="18" rx="11" ry="6" />
                    <path d="M28,16 L38,8 L40,10 L34,18 Z" />
                    <circle cx="41" cy="7" r="3.5" fill="#ef4444" className="animate-ping" />
                    <circle cx="41" cy="7" r="2.5" fill="#f87171" />
                    <path d="M34,8 L32,1 M33,5 L29,4 M37,7 L40,1 M38,4 L42,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M14,22 L9,33 M17,22 L13,31 M26,22 L33,31 M29,22 L37,30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </g>

                  {/* Riendas luminosas conectando los renos */}
                  <path d="M25,23 Q75,28 110,22 Q155,29 200,24 Q245,30 280,26" stroke="rgba(255,215,0,0.8)" strokeWidth="1.5" strokeDasharray="4,2" fill="none" />

                  {/* Reno 2 */}
                  <g transform="translate(75, 14)">
                    <ellipse cx="22" cy="18" rx="11" ry="6" />
                    <path d="M28,16 L38,8 L40,10 L34,18 Z" />
                    <circle cx="40" cy="8" r="2" />
                    <path d="M34,8 L32,1 M33,5 L29,4 M37,7 L40,1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M14,22 L8,32 M17,22 L12,30 M26,22 L34,31 M29,22 L38,29" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </g>

                  {/* Reno 3 */}
                  <g transform="translate(150, 16)">
                    <ellipse cx="22" cy="18" rx="11" ry="6" />
                    <path d="M28,16 L38,8 L40,10 L34,18 Z" />
                    <circle cx="40" cy="8" r="2" />
                    <path d="M34,8 L32,1 M33,5 L29,4 M37,7 L40,1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M14,22 L7,32 M17,22 L11,30 M26,22 L35,31 M29,22 L39,29" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </g>

                  {/* Trineo de Santa */}
                  <g transform="translate(225, 9)">
                    <circle cx="36" cy="8" r="5.5" fill="#f87171" />
                    <path d="M36,4 Q41,2 43,6" stroke="#ffffff" strokeWidth="2.2" fill="none" />
                    <circle cx="43" cy="7" r="2" fill="#ffffff" />
                    <ellipse cx="34" cy="19" rx="9" ry="8" fill="#ef4444" />
                    <ellipse cx="20" cy="17" rx="10" ry="9" fill="#d97706" />
                    <path d="M8,26 Q30,35 55,24 Q62,20 64,13 L55,13 Q46,28 12,22 Z" fill="#b91c1c" />
                    <path d="M4,30 Q32,37 61,28 L68,21" stroke="#f59e0b" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                  </g>
                </svg>

                {/* Polvo de estrellas mágicas que deja el trineo */}
                <div className="absolute top-6 -left-8 text-amber-300 animate-twinkle text-xs opacity-75">✦ ⋆ ✧</div>
              </div>
            </div>
          </div>

          {/* Copos de nieve flotando por TODA la altura de la pantalla */}
          {particles.map((p) => (
            <span
              key={p.id}
              className="absolute -top-8 text-white animate-ambient-snow font-serif drop-shadow-[0_0_6px_rgba(255,255,255,0.85)] select-none"
              style={{
                left: p.left,
                fontSize: p.size,
                opacity: p.opacity,
                animationDelay: p.delay,
                animationDuration: p.duration,
              }}
            >
              {p.id % 3 === 0 ? '❄' : p.id % 3 === 1 ? '❅' : '•'}
            </span>
          ))}
        </>
      )}

      {/* ===================================================================
          2. OTOÑO DORADO (AUTUMN_LEAVES)
          =================================================================== */}
      {activeEffect === 'AUTUMN_LEAVES' && (
        <>
          {particles.map((p) => {
            const isGold = p.id % 3 === 0;
            const isCrimson = p.id % 3 === 1;
            const leafColor = isGold ? '#f59e0b' : isCrimson ? '#dc2626' : '#ea580c';

            return (
              <div
                key={p.id}
                className="absolute -top-8 animate-autumn-leaf drop-shadow-[0_3px_6px_rgba(0,0,0,0.4)]"
                style={{
                  left: p.left,
                  animationDelay: p.delay,
                  animationDuration: `${6.5 + (p.id % 4) * 1.4}s`,
                  opacity: p.opacity + 0.15,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  style={{ fill: leafColor }}
                >
                  <path d="M12 2C11.5 5 9 6.5 7 8C5 9.5 3 11 3 13.5C3 16.5 5.5 19 8.5 19C10.5 19 11.5 18 12 17C12.5 18 13.5 19 15.5 19C18.5 19 21 16.5 21 13.5C21 11 19 9.5 17 8C15 6.5 12.5 5 12 2Z" />
                  <path d="M12 17L12 22" stroke={leafColor} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            );
          })}

          <div className="fixed -top-24 -right-24 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        </>
      )}

      {/* ===================================================================
          3. HALLOWEEN ESPECTRAL (SPOOKY_BATS & SPIDERS)
          =================================================================== */}
      {activeEffect === 'SPOOKY_BATS' && (
        <>
          {/* Vuelo de murciélagos en diagonal */}
          <div className="fixed top-14 sm:top-20 left-0 w-full pointer-events-none overflow-hidden h-40 z-40">
            <div className="absolute right-0 top-4 animate-bat-fly-ambient">
              <div className="flex items-center gap-8">
                <span className="text-3xl sm:text-4xl text-orange-400 drop-shadow-[0_0_12px_rgba(249,115,22,0.9)] animate-pulse">
                  🦇
                </span>
                <span className="text-xl sm:text-2xl text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)] mt-6">
                  🦇
                </span>
                <span className="text-2xl text-orange-300 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)] mt-2">
                  🦇
                </span>
              </div>
            </div>
          </div>

          {/* Araña esquina izquierda descendiendo desde arriba por su hilo */}
          <div className="fixed top-0 left-6 sm:left-12 pointer-events-none z-40 animate-spider-drop-left select-none">
            {/* Hilo de telaraña */}
            <div className="w-[1.5px] h-28 sm:h-36 bg-gradient-to-b from-zinc-500/20 via-zinc-300/60 to-zinc-100/90 mx-auto" />
            {/* Araña con balanceo */}
            <div className="relative -mt-1 flex flex-col items-center animate-spider-wiggle">
              <svg
                viewBox="0 0 40 40"
                className="w-7 h-7 sm:w-8 sm:h-8 text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.85)]"
                fill="currentColor"
              >
                {/* Cuerpo y Cefalotórax */}
                <ellipse cx="20" cy="20" rx="5.5" ry="6.5" fill="#18181b" stroke="#f97316" strokeWidth="1.6" />
                <circle cx="20" cy="12" r="3.8" fill="#f97316" />
                {/* Ojos rojos brillantes */}
                <circle cx="18.5" cy="11" r="1" fill="#ef4444" />
                <circle cx="21.5" cy="11" r="1" fill="#ef4444" />
                {/* 4 Patas izquierdas articuladas */}
                <path d="M16,14 Q8,8 5,13" stroke="#f97316" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M15,18 Q5,17 3,23" stroke="#f97316" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M15,21 Q6,26 5,32" stroke="#f97316" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M16,24 Q9,33 11,38" stroke="#f97316" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                {/* 4 Patas derechas articuladas */}
                <path d="M24,14 Q32,8 35,13" stroke="#f97316" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M25,18 Q35,17 37,23" stroke="#f97316" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M25,21 Q34,26 35,32" stroke="#f97316" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M24,24 Q31,33 29,38" stroke="#f97316" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Araña esquina derecha descendiendo con diferente altura y ritmo */}
          <div className="fixed top-0 right-8 sm:right-16 pointer-events-none z-40 animate-spider-drop-right select-none">
            {/* Hilo de telaraña */}
            <div className="w-[1.5px] h-20 sm:h-28 bg-gradient-to-b from-zinc-500/20 via-purple-300/60 to-purple-100/90 mx-auto" />
            {/* Araña morada con balanceo desfasado */}
            <div className="relative -mt-1 flex flex-col items-center animate-spider-wiggle-alt">
              <svg
                viewBox="0 0 40 40"
                className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.85)]"
                fill="currentColor"
              >
                <ellipse cx="20" cy="20" rx="5" ry="6" fill="#18181b" stroke="#a855f7" strokeWidth="1.5" />
                <circle cx="20" cy="12" r="3.5" fill="#a855f7" />
                <circle cx="18.5" cy="11" r="0.9" fill="#ef4444" />
                <circle cx="21.5" cy="11" r="0.9" fill="#ef4444" />
                <path d="M16,14 Q8,8 5,13" stroke="#a855f7" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <path d="M15,18 Q5,17 3,23" stroke="#a855f7" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <path d="M15,21 Q6,26 5,32" stroke="#a855f7" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <path d="M16,24 Q9,33 11,38" stroke="#a855f7" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <path d="M24,14 Q32,8 35,13" stroke="#a855f7" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <path d="M25,18 Q35,17 37,23" stroke="#a855f7" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <path d="M25,21 Q34,26 35,32" stroke="#a855f7" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <path d="M24,24 Q31,33 29,38" stroke="#a855f7" strokeWidth="1.3" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </>
      )}

      {/* ===================================================================
          4. SAN VALENTÍN (FLOATING_HEARTS)
          =================================================================== */}
      {activeEffect === 'FLOATING_HEARTS' && (
        <>
          {particles.map((p) => (
            <span
              key={p.id}
              className="absolute -bottom-8 animate-ambient-heart drop-shadow-[0_0_12px_rgba(255,105,180,0.7)] select-none"
              style={{
                left: p.left,
                fontSize: `${16 + (p.id % 8)}px`,
                opacity: p.opacity + 0.1,
                animationDelay: p.delay,
                animationDuration: `${5.5 + (p.id % 4) * 1.5}s`,
              }}
            >
              {p.id % 3 === 0 ? '💖' : p.id % 3 === 1 ? '🌸' : '💕'}
            </span>
          ))}

          {/* Resplandor sutil rosa en esquina */}
          <div className="fixed -bottom-20 -left-20 w-80 h-80 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        </>
      )}

      {/* ===================================================================
          5. AÑO NUEVO & FIESTA (CONFETTI & FIREWORKS)
          =================================================================== */}
      {(activeEffect === 'CONFETTI' || activeEffect === 'FIREWORKS') && (
        <>
          {/* Pirotecnia Fotorrealista en Canvas con física de partículas */}
          <FireworksCanvas density={activeEffect === 'FIREWORKS' ? 'dense' : 'normal'} />

          {/* Lluvia de Confeti festivo */}
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute -top-6 w-3 h-2 rounded-[2px] animate-ambient-confetti drop-shadow-sm pointer-events-none"
              style={{
                left: p.left,
                backgroundColor: ['#ffd700', '#38bdf8', '#f43f5e', '#a855f7', '#4ade80', '#fb923c'][p.id % 6],
                opacity: p.opacity + 0.2,
                animationDelay: p.delay,
                animationDuration: `${3.5 + (p.id % 4) * 0.9}s`,
                transform: `rotate(${p.rotation})`,
              }}
            />
          ))}

          {/* Resplandores ambientales dorados / festivos */}
          <div className="fixed -top-16 -left-16 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="fixed -top-16 -right-16 w-80 h-80 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        </>
      )}

      {/* ===================================================================
          6. CYBERPUNK / NEÓN (CYBER_GLOW)
          =================================================================== */}
      {activeEffect === 'CYBER_GLOW' && (
        <>
          <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#00f0ff] animate-pulse" />
          <div className="fixed bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#00f0ff] animate-pulse" />
          {particles.slice(0, 10).map((p) => (
            <div
              key={p.id}
              className="absolute top-1/3 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#00f0ff] animate-ping"
              style={{
                left: p.left,
                animationDelay: p.delay,
                animationDuration: `${2 + (p.id % 3)}s`,
              }}
            />
          ))}
        </>
      )}

      {/* ===================================================================
          7. PROMOS & DESTELLOS (SPARKLES)
          =================================================================== */}
      {activeEffect === 'SPARKLES' && (
        <>
          {particles.slice(0, 14).map((p) => (
            <span
              key={p.id}
              className="absolute top-1/4 text-amber-200 animate-twinkle drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] select-none"
              style={{
                left: p.left,
                top: `${15 + (p.id * 3.5)}%`,
                fontSize: `${12 + (p.id % 8)}px`,
                opacity: p.opacity,
                animationDelay: p.delay,
                animationDuration: `${2.2 + (p.id % 3) * 0.6}s`,
              }}
            >
              ✦
            </span>
          ))}
        </>
      )}
    </div>
  );
}
