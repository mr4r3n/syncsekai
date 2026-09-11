'use client';

import React, { useEffect, useRef } from 'react';

interface FireworksCanvasProps {
  density?: 'normal' | 'dense';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
  decay: number;
  gravity: number;
  friction: number;
  flicker: boolean;
}

interface Rocket {
  x: number;
  y: number;
  targetY: number;
  vx: number;
  vy: number;
  color: string;
  trail: { x: number; y: number; alpha: number }[];
}

const PALETTES = [
  ['#ffd700', '#ffae00', '#fff3b0', '#ffffff'], // Oro Real / Celebración
  ['#ff2a6d', '#ff5e97', '#ffffff', '#ff99c8'], // Rubí & Rosa Neón
  ['#00f0ff', '#38bdf8', '#7dd3fc', '#ffffff'], // Cian Neón / Hielo
  ['#a855f7', '#c084fc', '#e9d5ff', '#ffd700'], // Púrpura Imperial & Oro
  ['#10b981', '#34d399', '#6ee7b7', '#ffd700'], // Esmeralda & Chispa
];

export function FireworksCanvas({ density = 'normal' }: FireworksCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles: Particle[] = [];
    const rockets: Rocket[] = [];

    const createExplosion = (x: number, y: number, colorPalette: string[]) => {
      const particleCount = density === 'dense' ? 65 : 45;
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4.5;
        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];

        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color,
          size: Math.random() * 2.2 + 1.2,
          decay: 0.012 + Math.random() * 0.018,
          gravity: 0.045,
          friction: 0.96,
          flicker: Math.random() > 0.3,
        });
      }

      // Destello central brillante
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1.5;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color: '#ffffff',
          size: 2.5,
          decay: 0.035,
          gravity: 0.02,
          friction: 0.92,
          flicker: true,
        });
      }
    };

    const launchRocket = () => {
      const x = width * 0.15 + Math.random() * (width * 0.7);
      const targetY = height * 0.12 + Math.random() * (height * 0.35);
      const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      const color = palette[0];
      const vy = -(7 + Math.random() * 3.5);
      const vx = (Math.random() - 0.5) * 1.5;

      rockets.push({
        x,
        y: height + 10,
        targetY,
        vx,
        vy,
        color,
        trail: [],
      });
    };

    let lastLaunch = 0;
    const launchInterval = density === 'dense' ? 900 : 1400;

    const render = (time: number) => {
      // Limpiar con ligero rastro transparente para estelas suaves
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      // Lanzar cohetes periódicamente
      if (time - lastLaunch > launchInterval + Math.random() * 500) {
        launchRocket();
        lastLaunch = time;
      }

      // Actualizar & Dibujar Cohetes
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.trail.push({ x: r.x, y: r.y, alpha: 0.8 });
        if (r.trail.length > 7) r.trail.shift();

        r.x += r.vx;
        r.y += r.vy;

        // Dibujar estela del cohete
        ctx.beginPath();
        for (let j = 0; j < r.trail.length; j++) {
          const t = r.trail[j];
          ctx.fillStyle = `rgba(255, 215, 0, ${(j / r.trail.length) * 0.6})`;
          ctx.arc(t.x, t.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Cabeza del cohete
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Si llega a la altura objetivo o desacelera, explotar
        if (r.y <= r.targetY || r.vy >= -1) {
          const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
          createExplosion(r.x, r.y, palette);
          rockets.splice(i, 1);
        }
      }

      // Actualizar & Dibujar Partículas
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const currentAlpha = p.flicker && Math.random() > 0.4 ? p.alpha * 0.5 : p.alpha;
        ctx.save();
        ctx.globalAlpha = Math.max(0, currentAlpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-30 w-full h-full"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
