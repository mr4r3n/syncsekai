'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useToast } from './ToastProvider';
import { useI18n } from '@/i18n/I18nProvider';

export function ThemeToggle() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  const syncThemeState = () => {
    if (typeof window === 'undefined') return;
    const savedTheme = (localStorage.getItem('plexsync_theme') as 'dark' | 'light') || 'dark';
    const savedSelectedTheme = localStorage.getItem('plexsync_selected_theme');
    
    if (savedSelectedTheme === 'claro') {
      setTheme('light');
      setSelectedThemeId('claro');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      setTheme(savedTheme);
      setSelectedThemeId(savedSelectedTheme);
      // Esta rama actualizaba el estado de React pero no el DOM. Como el servidor
      // emite siempre data-theme="dark", al recargar la página volvía a oscuro
      // aunque el botón mostrara "claro" y la preferencia estuviera guardada.
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  };

  useEffect(() => {
    syncThemeState();

    const handleStorageChange = () => syncThemeState();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('plexsync_theme_changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('plexsync_theme_changed', handleStorageChange);
    };
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    
    // Transición suave
    document.documentElement.classList.add('theme-transitioning');
    setTheme(next);
    localStorage.setItem('plexsync_theme', next);
    if (next === 'light') {
      localStorage.setItem('plexsync_selected_theme', 'claro');
      setSelectedThemeId('claro');
    } else {
      localStorage.setItem('plexsync_selected_theme', 'sync');
      setSelectedThemeId('sync');
    }
    document.documentElement.setAttribute('data-theme', next);
    window.dispatchEvent(new Event('plexsync_theme_changed'));

    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 350);
  };

  return (
    <button
      onClick={toggleTheme}
      aria-label={
        theme === 'dark'
          ? t('topbar.switchToLight', { defaultValue: 'Cambiar a Modo Claro' })
          : t('topbar.switchToDark', { defaultValue: 'Cambiar a Modo Oscuro' })
      }
      title={
        theme === 'dark'
          ? t('topbar.switchToLight', { defaultValue: 'Cambiar a Modo Claro' })
          : t('topbar.switchToDark', { defaultValue: 'Cambiar a Modo Oscuro' })
      }
      className="w-9 h-9 rounded-[6px] flex items-center justify-center transition-all duration-200 border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] backdrop-blur-md hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] active:scale-[0.96] text-[var(--text-primary)] shadow-sm cursor-pointer"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-400 transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
}
