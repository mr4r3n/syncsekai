'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, Shield, Check, X, Sliders, ExternalLink } from 'lucide-react';
import { useModalA11y } from './useModalA11y';
import { useI18n } from '@/i18n/I18nProvider';

interface CookiePreferences {
  essential: boolean;
  preferences: boolean;
  timestamp: number;
}

export function CookieConsentBanner() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true, // Siempre true
    themePreferences: true,
  });

  // El banner en sí NO es modal: atrapar el foco en un aviso de cookies impide
  // leer la política antes de decidir. Ya se anuncia como región con nombre.
  // El modal de personalización sí lo es, y necesita foco y Escape.
  const { dialogProps: dialogPropsConfig } = useModalA11y(
    showConfigModal,
    () => setShowConfigModal(false),
  );

  useEffect(() => {
    // Comprobar si ya existe consentimiento guardado
    const saved = localStorage.getItem('plexsync_cookie_consent');
    if (!saved) {
      // Pequeño retardo para no interferir con la carga inicial
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Escuchar evento personalizado para re-abrir desde el footer
  useEffect(() => {
    const handleOpenBanner = () => {
      setIsOpen(true);
    };
    window.addEventListener('open_cookie_settings', handleOpenBanner);
    return () => window.removeEventListener('open_cookie_settings', handleOpenBanner);
  }, []);

  const saveConsent = (prefs: { essential: boolean; preferences: boolean }) => {
    const consentData: CookiePreferences = {
      essential: true,
      preferences: prefs.preferences,
      timestamp: Date.now(),
    };
    localStorage.setItem('plexsync_cookie_consent', JSON.stringify(consentData));
    setIsOpen(false);
    setShowConfigModal(false);
  };

  const handleAcceptAll = () => {
    saveConsent({ essential: true, preferences: true });
  };

  const handleAcceptEssentialOnly = () => {
    saveConsent({ essential: true, preferences: false });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* BANNER FLOTANTE MINIMALISTA EN LA ESQUINA INFERIOR */}
      <div
        role="region"
        aria-label={t('cookies.bannerLabel')}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
      >
        <div className="p-5 rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-2xl shadow-2xl space-y-4 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[6px] bg-[#FF634A]/10 text-[#FF634A] border border-[#FF634A]/20 flex items-center justify-center shrink-0">
              <Cookie className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-[var(--text-primary)] font-heading flex items-center gap-2">
                <span>{t('cookies.title')}</span>
              </h3>
              <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">{t('cookies.intro')}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 text-[var(--text-muted)] font-mono border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <Link href="/privacy" className="hover:text-[var(--text-primary)] underline">{t('cookies.privacy')}</Link>
              <Link href="/terms" className="hover:text-[var(--text-primary)] underline">{t('cookies.terms')}</Link>
            </div>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="text-[var(--accent-text)] hover:underline flex items-center gap-1 cursor-pointer font-bold"
            >
              <Sliders className="w-3 h-3" />
              <span>{t('cookies.customise')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleAcceptAll}
              className="flex-1 px-3 py-2 rounded-[6px] bg-[#FF634A] text-white hover:bg-[#ff4d30] font-bold text-xs shadow-md shadow-[#FF634A]/20 transition-all cursor-pointer text-center"
            >
              {t('cookies.acceptAll')}
            </button>
            <button
              type="button"
              onClick={handleAcceptEssentialOnly}
              className="px-3 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] font-semibold text-xs transition-colors cursor-pointer"
            >{t('cookies.essentialOnly')}</button>
          </div>
        </div>
      </div>

      {/* MODAL DE PERSONALIZACIÓN DETALLADA DE COOKIES */}
      {showConfigModal && (
        <div
          {...dialogPropsConfig}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 rounded-[8px] border border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] backdrop-blur-xl shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-sky-400" />
                <h2 className="font-bold text-base text-[var(--text-primary)] font-heading">
                  {t('cookies.settingsTitle')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Cookies Técnicas / Esenciales */}
              <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text-primary)]">{t('cookies.essentialTitle')}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      Obligatorias
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="rounded accent-[var(--accent-primary)] cursor-not-allowed opacity-70"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t('cookies.essentialDesc')}</p>
              </div>

              {/* Cookies de Preferencias Visuales */}
              <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text-primary)]">Preferencias de Interfaz &amp; Tema</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      Opcional
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    id="prefCookie"
                    checked={preferences.themePreferences}
                    onChange={(e) => setPreferences({ ...preferences, themePreferences: e.target.checked })}
                    className="rounded accent-[var(--accent-primary)] cursor-pointer w-4 h-4"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t('cookies.preferencesDesc')}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="btn-secondary text-xs"
              >{t('common.cancel')}</button>
              <button
                type="button"
                onClick={() => saveConsent({ essential: true, preferences: preferences.themePreferences })}
                className="px-4 py-2 rounded-[6px] bg-[#FF634A] text-white hover:bg-[#ff4d30] font-bold text-xs shadow-md shadow-[#FF634A]/20 transition-all cursor-pointer"
              >{t('cookies.savePreferences')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
