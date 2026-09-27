'use client';

import React, { useMemo } from 'react';

interface BannerParticleEngineProps {
  effectType?: string; // NONE, SNOWFLAKES, FLOATING_HEARTS, CONFETTI, SPOOKY_BATS, CYBER_GLOW, SPARKLES
}

export function BannerParticleEngine({ effectType = 'NONE' }: BannerParticleEngineProps) {
  // Generar partículas pre-calculadas estables para evitar re-renders innecesarios
  const particles = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => ({
      id: i,
      left: `${(i * 6.25) + (Math.sin(i * 1.5) * 2)}%`,
      delay: `${(i * 0.35) % 3.5}s`,
      duration: `${3.5 + ((i % 4) * 0.8)}s`,
      size: `${10 + ((i * 3) % 12)}px`,
      opacity: 0.25 + ((i % 5) * 0.15),
      rotation: `${(i * 45) % 360}deg`,
      color: ['#ffd700', '#ff4d4f', '#00f0ff', '#52c41a', '#eb2f96', '#722ed1'][i % 6],
    }));
  }, []);

  if (!effectType || effectType === 'NONE') {
    return null;
  }

  // 1. SNOWFLAKES (Navidad & Invierno)
  if (effectType === 'SNOWFLAKES') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute -top-4 text-white animate-snowflake font-serif"
            style={{
              left: p.left,
              fontSize: p.size,
              opacity: p.opacity,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          >
            ❄
          </span>
        ))}
      </div>
    );
  }

  // 2. FLOATING_HEARTS (San Valentín)
  if (effectType === 'FLOATING_HEARTS') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute -bottom-4 text-pink-300 animate-floating-heart drop-shadow-[0_0_8px_rgba(255,105,180,0.6)]"
            style={{
              left: p.left,
              fontSize: p.size,
              opacity: p.opacity + 0.2,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          >
            {p.id % 2 === 0 ? '💖' : '🌸'}
          </span>
        ))}
      </div>
    );
  }

  // 3. CONFETTI & FIREWORKS (Año Nuevo & Celebraciones)
  if (effectType === 'CONFETTI' || effectType === 'FIREWORKS') {
    const fireworkBursts = [
      { id: 1, left: '18%', top: '45%', color: '#ffd700', delay: '0s', duration: '2.4s' },
      { id: 2, left: '52%', top: '35%', color: '#00f0ff', delay: '0.8s', duration: '2.8s' },
      { id: 3, left: '82%', top: '50%', color: '#ff2a6d', delay: '1.5s', duration: '2.5s' },
    ];

    const sparkAngles = [
      { tx: '28px', ty: '0px' },
      { tx: '20px', ty: '20px' },
      { tx: '0px', ty: '28px' },
      { tx: '-20px', ty: '20px' },
      { tx: '-28px', ty: '0px' },
      { tx: '-20px', ty: '-20px' },
      { tx: '0px', ty: '-28px' },
      { tx: '20px', ty: '-20px' },
    ];

    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Explosiones de Fuegos Artificiales en el Banner */}
        {fireworkBursts.map((b) => (
          <div
            key={b.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: b.left, top: b.top }}
          >
            {/* Destello central */}
            <div
              className="absolute w-4 h-4 -left-2 -top-2 rounded-full animate-firework-flash blur-[1px]"
              style={{
                backgroundColor: b.color,
                boxShadow: `0 0 14px 2px ${b.color}`,
                animationDelay: b.delay,
                animationDuration: b.duration,
              }}
            />
            {/* Chispas radiales */}
            {sparkAngles.map((angle, sIdx) => (
              <span
                key={sIdx}
                className="absolute w-1.5 h-1.5 -left-[3px] -top-[3px] rounded-full animate-firework-spark"
                style={
                  {
                    '--tx': angle.tx,
                    '--ty': angle.ty,
                    backgroundColor: b.color,
                    boxShadow: `0 0 8px ${b.color}`,
                    animationDelay: b.delay,
                    animationDuration: b.duration,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        ))}

        {/* Lluvia de Confeti multicolor */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute -top-3 w-2.5 h-1.5 rounded-[2px] animate-confetti-fall"
            style={{
              left: p.left,
              backgroundColor: p.color,
              opacity: p.opacity + 0.3,
              animationDelay: p.delay,
              animationDuration: `${2.5 + (p.id % 3)}s`,
              transform: `rotate(${p.rotation})`,
            }}
          />
        ))}
      </div>
    );
  }

  // 4. SPOOKY_BATS (Halloween)
  if (effectType === 'SPOOKY_BATS') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {particles.slice(0, 6).map((p) => (
          <span
            key={p.id}
            className="absolute -left-10 text-orange-200 animate-bat-fly drop-shadow-[0_0_6px_rgba(255,140,0,0.5)]"
            style={{
              top: `${20 + (p.id * 12)}%`,
              fontSize: `${14 + (p.id * 3)}px`,
              opacity: 0.75,
              animationDelay: `${p.id * 1.6}s`,
              animationDuration: `${7 + (p.id * 1.5)}s`,
            }}
          >
            🦇
          </span>
        ))}
      </div>
    );
  }

  // 5. AUTUMN_LEAVES (Otoño Dorado)
  if (effectType === 'AUTUMN_LEAVES') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {particles.slice(0, 12).map((p) => (
          <span
            key={p.id}
            className="absolute -top-4 animate-snowflake select-none"
            style={{
              left: p.left,
              fontSize: `${12 + (p.id % 6)}px`,
              opacity: 0.7 + ((p.id % 3) * 0.1),
              animationDelay: p.delay,
              animationDuration: `${4 + (p.id % 3)}s`,
              color: p.id % 2 === 0 ? '#f59e0b' : '#ea580c',
            }}
          >
            {p.id % 3 === 0 ? '🍂' : p.id % 3 === 1 ? '🍁' : '🍃'}
          </span>
        ))}
      </div>
    );
  }

  // 6. CYBER_GLOW (Cyberpunk / Neón)
  if (effectType === 'CYBER_GLOW') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(0,240,255,0.25)_50%,transparent_100%)] animate-cyber-sweep" />
        {particles.slice(0, 8).map((p) => (
          <span
            key={p.id}
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#00f0ff] animate-ping"
            style={{
              left: p.left,
              animationDelay: p.delay,
              animationDuration: `${1.8 + (p.id * 0.4)}s`,
            }}
          />
        ))}
      </div>
    );
  }

  // 6. SPARKLES (Promociones / MEE6)
  if (effectType === 'SPARKLES') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {particles.slice(0, 10).map((p) => (
          <span
            key={p.id}
            className="absolute top-1/2 -translate-y-1/2 text-amber-200 animate-twinkle"
            style={{
              left: p.left,
              fontSize: `${10 + (p.id % 6)}px`,
              opacity: p.opacity,
              animationDelay: p.delay,
              animationDuration: `${2 + (p.id * 0.3)}s`,
            }}
          >
            ✦
          </span>
        ))}
      </div>
    );
  }

  return null;
}
