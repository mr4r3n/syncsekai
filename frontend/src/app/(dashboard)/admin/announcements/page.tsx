'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Topbar } from '@/components/Topbar';
import { AnnouncementBanner, AnnouncementData } from '@/components/AnnouncementBanner';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Megaphone,
  Save,
  Power,
  RotateCcw,
  Upload,
  Image as ImageIcon,
  Palette,
  Type,
  Eye,
  Smartphone,
  Monitor,
  CheckCircle2,
  Calendar,
  Users,
  Clock,
  HelpCircle,
  Loader2,
  Sliders,
  BookmarkPlus,
  Bookmark,
  Trash2,
  X,
  Globe,
} from 'lucide-react';
import { GlobalAtmosphere } from '@/components/banner-effects/GlobalAtmosphere';
import { CustomSelect } from '@/components/CustomSelect';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useModalA11y } from '@/components/useModalA11y';

const PRESET_GRADIENTS = [
  { name: 'announcements.gradEmerald', value: 'linear-gradient(90deg, #0ba360 0%, #3cba92 100%)' },
  { name: 'announcements.gradSky', value: 'linear-gradient(90deg, #00c6ff 0%, #0072ff 100%)' },
  { name: 'announcements.themeChristmas', value: 'linear-gradient(90deg, #1b4332 0%, #2d6a4f 50%, #b7094c 100%)' },
  { name: 'announcements.themeAutumn', value: 'linear-gradient(90deg, #451a03 0%, #9a3412 50%, #b45309 100%)' },
  { name: 'announcements.themeValentine', value: 'linear-gradient(90deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)' },
  { name: 'announcements.themeHalloween', value: 'linear-gradient(90deg, #1a0826 0%, #4a154b 50%, #e85d04 100%)' },
  { name: 'announcements.themeNewYear', value: 'linear-gradient(90deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { name: 'announcements.themeCyberpunk', value: 'linear-gradient(90deg, #050505 0%, #001f3f 50%, #00f0ff 100%)' },
  { name: 'announcements.themeMaintenance', value: 'linear-gradient(90deg, #451a03 0%, #78350f 100%)' },
  { name: 'announcements.themeCritical', value: 'linear-gradient(90deg, #450a0a 0%, #7f1d1d 100%)' },
];

const EFFECT_OPTIONS = [
  { id: 'NONE', label: 'announcements.fxNone', desc: 'announcements.fxNoneDesc' },
  { id: 'FIREWORKS', label: 'announcements.fxFireworks', desc: 'announcements.fxFireworksDesc' },
  { id: 'SNOWFLAKES', label: 'announcements.fxSnow', desc: 'announcements.fxSnowDesc' },
  { id: 'AUTUMN_LEAVES', label: 'announcements.fxLeaves', desc: 'announcements.fxLeavesDesc' },
  { id: 'FLOATING_HEARTS', label: 'announcements.fxHeartsLabel', desc: 'announcements.fxHearts' },
  { id: 'CONFETTI', label: 'announcements.fxConfettiLabel', desc: 'announcements.fxConfetti' },
  { id: 'SPOOKY_BATS', label: 'announcements.fxBats', desc: 'announcements.fxBatsDesc' },
  { id: 'CYBER_GLOW', label: 'announcements.fxNeon', desc: 'announcements.fxNeonDesc' },
  { id: 'SPARKLES', label: 'announcements.fxSparklesLabel', desc: 'announcements.fxSparkles' },
];

function toDatetimeLocal(isoStr?: string | null) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const tzOffset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - tzOffset);
    return local.toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

function fromDatetimeLocal(localStr: string) {
  if (!localStr) return null;
  try {
    const d = new Date(localStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

type Traductor = (key: string, vars?: Record<string, string | number>) => string;

// Recibe t y el idioma porque es un ayudante, no un componente: no puede usar el hook.
function formatReadableDate(t: Traductor, locale: string, isoStr?: string | null) {
  if (!isoStr) return t('announcements.undefined');
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

export default function AdminAnnouncementsPage() {
  const { showToast } = useToast();
  const { isCollapsed } = useSidebar();
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'visuals' | 'media' | 'schedule' | 'rules'>('content');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'FESTIVE' | 'PROMO' | 'INFO' | 'CUSTOM'>('ALL');

  const [presets, setPresets] = useState<any[]>([]);
  const [customPresets, setCustomPresets] = useState<any[]>([]);
  const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  const [formData, setFormData] = useState<AnnouncementData>({
    isActive: false,
    category: 'FESTIVE',
    themePreset: 'CHRISTMAS',
    badgeText: t('announcements.undefined'),
    badgeBgColor: '#e53935',
    badgeTextColor: '#ffffff',
    message: t('announcements.sampleBadge'),
    mediaType: 'NONE',
    mediaUrl: null,
    mediaPosition: 'LEFT',
    backgroundType: 'GRADIENT',
    backgroundValue: 'linear-gradient(90deg, #1b4332 0%, #2d6a4f 50%, #b7094c 100%)',
    textColor: '#ffffff',
    effectType: 'SNOWFLAKES',
    enableGlobalAtmosphere: true,
    ctaText: t('announcements.sampleMessage'),
    ctaUrl: '/catalog',
    ctaTarget: '_self',
    ctaBgColor: '#ffffff',
    ctaTextColor: '#1b4332',
    isClosable: true,
    dismissExpiryDays: 7,
    targetAudience: 'ALL',
    startsAt: null,
    endsAt: null,
  });

  const [initialFormData, setInitialFormData] = useState<string>('');
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null);
  const [showApplyPresetConfirm, setShowApplyPresetConfirm] = useState(false);
  const [isSavePresetModalClosing, setIsSavePresetModalClosing] = useState(false);
  const [showDiscardPresetPrompt, setShowDiscardPresetPrompt] = useState(false);

  // Semántica de diálogo y gestión de foco del modal de esta vista.
  const { dialogProps: propsPreset } = useModalA11y(Boolean(isSavePresetModalOpen), () => handleAttemptCloseSavePresetModal());

  const isDirty = initialFormData ? JSON.stringify(formData) !== initialFormData : false;

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await api.announcements.getAdminConfig();
      if (res?.announcement) {
        setFormData(res.announcement);
        setInitialFormData(JSON.stringify(res.announcement));
      }
      if (res?.presets) {
        setPresets(res.presets);
      }
      if (res?.customPresets) {
        setCustomPresets(res.customPresets);
      }
    } catch (err: any) {
      showToast(err.message || t('announcements.sampleCta'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload: any = { ...formData };
      delete payload.id;
      delete payload.createdAt;
      delete payload.updatedAt;
      const res = await api.announcements.update(payload);
      showToast(res.message || t('announcements.loadConfigError'), 'success');
      if (res.announcement) {
        setFormData(res.announcement);
        setInitialFormData(JSON.stringify(res.announcement));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('plexsync:announcement-updated', { detail: res.announcement }));
        }
      }
    } catch (err: any) {
      showToast(err.message || t('announcements.alertSaved'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      const nextState = !formData.isActive;
      const res = await api.announcements.toggle(nextState);
      setFormData((prev) => ({ ...prev, isActive: res.isActive }));
      if (res.announcement && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('plexsync:announcement-updated', { detail: res.announcement }));
      }
      showToast(res.message, res.isActive ? 'success' : 'info');
    } catch (err: any) {
      showToast(err.message || t('announcements.saveChangesError'), 'error');
    }
  };

  const executeApplyPreset = async (presetId: string) => {
    try {
      setSaving(true);
      const res = await api.announcements.applyPreset(presetId);
      if (res?.announcement) {
        setFormData(res.announcement);
        setInitialFormData(JSON.stringify(res.announcement));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('plexsync:announcement-updated', { detail: res.announcement }));
        }
      }
      showToast(res?.message || 'Plantilla aplicada.', 'success');
    } catch (err: any) {
      showToast(err.message || t('announcements.toggleStateError'), 'error');
    } finally {
      setSaving(false);
      setPendingPresetId(null);
    }
  };

  const handleApplyPreset = (presetId: string) => {
    if (isDirty) {
      setPendingPresetId(presetId);
      setShowApplyPresetConfirm(true);
    } else {
      executeApplyPreset(presetId);
    }
  };

  const closeSavePresetModalWithAnimation = useCallback(() => {
    setIsSavePresetModalClosing(true);
    setTimeout(() => {
      setIsSavePresetModalOpen(false);
      setNewPresetName('');
      setIsSavePresetModalClosing(false);
    }, 200);
  }, []);

  const handleAttemptCloseSavePresetModal = useCallback(() => {
    if (newPresetName.trim().length > 0) {
      setShowDiscardPresetPrompt(true);
    } else {
      closeSavePresetModalWithAnimation();
    }
  }, [newPresetName, closeSavePresetModalWithAnimation]);

  const handleSaveCustomPreset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPresetName.trim()) {
      showToast(t('announcements.applyTemplateError'), 'error');
      return;
    }

    try {
      setSavingPreset(true);
      const payload = {
        name: newPresetName.trim(),
        category: 'CUSTOM',
        themePreset: formData.themePreset || 'CUSTOM',
        badgeText: formData.badgeText,
        badgeBgColor: formData.badgeBgColor,
        badgeTextColor: formData.badgeTextColor,
        message: formData.message,
        mediaType: formData.mediaType,
        mediaUrl: formData.mediaUrl,
        mediaPosition: formData.mediaPosition,
        backgroundType: formData.backgroundType,
        backgroundValue: formData.backgroundValue,
        textColor: formData.textColor,
        effectType: formData.effectType,
        enableGlobalAtmosphere: formData.enableGlobalAtmosphere,
        ctaText: formData.ctaText,
        ctaUrl: formData.ctaUrl,
        ctaTarget: formData.ctaTarget,
        ctaBgColor: formData.ctaBgColor,
        ctaTextColor: formData.ctaTextColor,
        isClosable: formData.isClosable,
      };

      const res = await api.announcements.saveCustomPreset(payload);
      showToast(res.message || 'Plantilla personalizada guardada.', 'success');
      setCustomPresets((prev) => [res.preset, ...prev]);
      setIsSavePresetModalOpen(false);
      setNewPresetName('');
      setSelectedCategory('CUSTOM');
    } catch (err: any) {
      showToast(err.message || t('announcements.writeTemplateName'), 'error');
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeleteCustomPreset = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Estás seguro de eliminar la plantilla personalizada "${name}"?`)) {
      return;
    }

    try {
      await api.announcements.deleteCustomPreset(id);
      showToast(`Plantilla "${name}" eliminada.`, 'info');
      setCustomPresets((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      showToast(err.message || t('announcements.saveTemplateError'), 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      showToast(t('announcements.deleteTemplateError'), 'error');
      return;
    }

    try {
      setUploadingMedia(true);
      const res = await api.announcements.uploadMedia(file);
      const isGif = file.type === 'image/gif';
      setFormData((prev) => ({
        ...prev,
        mediaUrl: res.mediaUrl,
        mediaType: isGif ? 'GIF' : 'IMAGE',
      }));
      showToast(t('announcements.fileTooLarge'), 'success');
    } catch (err: any) {
      showToast(err.message || t('announcements.fileUploaded'), 'error');
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  };

  const applyDurationDays = (days: number) => {
    const now = new Date();
    const start = formData.startsAt ? new Date(formData.startsAt) : now;
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    setFormData({
      ...formData,
      startsAt: formData.startsAt || start.toISOString(),
      endsAt: end.toISOString(),
    });
    showToast(`Programado por ${days} día${days > 1 ? 's' : ''}`, 'info');
  };

  const clearScheduleDates = () => {
    setFormData({
      ...formData,
      startsAt: null,
      endsAt: null,
    });
    showToast(t('announcements.uploadFileError'), 'info');
  };

  // Cálculo de estado de vigencia
  const scheduleStatus = (() => {
    if (!formData.isActive) {
      return {
        type: 'INACTIVE',
        badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
        title: t('announcements.scheduleRemoved'),
        message: t('announcements.alertDisabled'),
      };
    }
    const now = new Date();
    if (formData.startsAt && new Date(formData.startsAt) > now) {
      const diffMs = new Date(formData.startsAt).getTime() - now.getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return {
        type: 'SCHEDULED',
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        title: t('announcements.alertDisabledDesc'),
        message: `Comenzará automáticamente el ${formatReadableDate(t, locale, formData.startsAt)} (en ${days > 0 ? `${days}d ` : ''}${hours}h).`,
      };
    }
    if (formData.endsAt && new Date(formData.endsAt) < now) {
      return {
        type: 'EXPIRED',
        badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        title: 'Plazo Expirado',
        message: `Finalizó el ${formatReadableDate(t, locale, formData.endsAt)}. El banner ya no es visible para los usuarios.`,
      };
    }
    if (formData.endsAt) {
      const diffMs = new Date(formData.endsAt).getTime() - now.getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return {
        type: 'ACTIVE_TIMED',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        title: t('announcements.scheduledToStart'),
        message: `Visible en producción hasta el ${formatReadableDate(t, locale, formData.endsAt)} (restan ${days > 0 ? `${days}d ` : ''}${hours}h).`,
      };
    }
    return {
      type: 'ACTIVE_INDEFINITE',
      badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      title: t('announcements.activeInWindow'),
      message: t('announcements.activeIndefinitely'),
    };
  })();

  if (loading) {
    return (
      <div
        className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
          isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
        } pl-0 flex flex-col`}
      >
        <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.announcementsTitle')} isAdmin />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
          <p className="text-xs font-mono text-[var(--text-muted)]">{t('announcements.loadingStudio')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.announcementsTitle')} isAdmin />

      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('announcements.studioTitle')}</h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{t('announcements.studioSubtitle')}</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Toggle Switch Maestro */}
              <button
                type="button"
                onClick={handleToggleActive}
                className={`h-10 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-bold transition-all duration-180 flex items-center gap-2 cursor-pointer shadow-sm border ${
                  formData.isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Power className="w-4 h-4" />
                <span>{formData.isActive ? t('announcements.activeIndefinitelyDesc') : 'Desactivada'}</span>
              </button>

              {/* Guardar como Nueva Plantilla */}
              <button
                type="button"
                onClick={() => setIsSavePresetModalOpen(true)}
                className="h-10 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                title={t('announcements.saveAsTemplateTooltip')}
              >
                <BookmarkPlus className="w-4 h-4 text-amber-400" />
                <span>{t('announcements.saveAsTemplate')}</span>
              </button>

              {/* Guardar Cambios con Indicador de Cambios Sin Guardar */}
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="h-10 px-5 sm:px-6 rounded-[6px] text-xs sm:text-sm font-bold bg-[#FF634A] text-white hover:bg-[#ff4d30] shadow-md shadow-[#FF634A]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{t('announcements.saveChanges')}</span>
                  {isDirty && (
                    <span className="w-2 h-2 rounded-full bg-white animate-ping ml-1" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6 min-w-0">
        {/* LIVE PREVIEW BOX */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.livePreview')}</span>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className={`p-1.5 rounded-[4px] transition-colors cursor-pointer ${
                  previewMode === 'desktop'
                    ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
                title="Vista Escritorio"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={`p-1.5 rounded-[4px] transition-colors cursor-pointer ${
                  previewMode === 'mobile'
                    ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
                title={t('announcements.mobileView')}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            className={`transition-all duration-300 mx-auto rounded-[8px] overflow-hidden border border-[var(--border-subtle)] shadow-md ${
              previewMode === 'mobile' ? 'max-w-md' : 'w-full'
            }`}
          >
            <AnnouncementBanner
              previewData={formData}
              isPreview
              isMobilePreview={previewMode === 'mobile'}
            />
          </div>
        </section>

        {/* PRESET TEMPLATES GALLERY */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.templateGallery')}</span>
            </div>

            <button
              type="button"
              onClick={() => setIsSavePresetModalOpen(true)}
              className="text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>{t('announcements.saveCurrentAsTemplate')}</span>
            </button>
          </div>

          {/* Categorías de Filtro */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-[6px] text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border shrink-0 ${
                selectedCategory === 'ALL'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span>Todas</span>
              <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
                {presets.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('FESTIVE')}
              className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-[6px] text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border shrink-0 ${
                selectedCategory === 'FESTIVE'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span>Festivas &amp; Temporadas</span>
              <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300">
                {presets.filter((p) => p.category === 'FESTIVE').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('PROMO')}
              className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-[6px] text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border shrink-0 ${
                selectedCategory === 'PROMO'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span>{t('announcements.promotions')}</span>
              <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300">
                {presets.filter((p) => p.category === 'PROMO').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('INFO')}
              className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-[6px] text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border shrink-0 ${
                selectedCategory === 'INFO'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span>Informativas &amp; Estado</span>
              <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300">
                {presets.filter((p) => p.category === 'INFO').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('CUSTOM')}
              className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-[6px] text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border shrink-0 ${
                selectedCategory === 'CUSTOM'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span>{t('announcements.myTemplates')}</span>
              <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300">
                {customPresets.length}
              </span>
            </button>
          </div>

          {/* LISTADO DE PLANTILLAS DEL SISTEMA FILTRADAS */}
          {selectedCategory !== 'CUSTOM' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-4 gap-3">
              {(selectedCategory === 'ALL'
                ? presets
                : presets.filter((p) => p.category === selectedCategory)
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset.id)}
                  className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] text-left transition-all duration-180 hover:-translate-y-0.5 active:translate-y-0 shadow-sm cursor-pointer flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-bold block truncate text-[var(--text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors">
                        {preset.name}
                      </span>
                      {preset.enableGlobalAtmosphere && (
                        <span className="text-[11px] px-2 py-0.5 rounded-[4px] bg-amber-500/15 text-amber-400 font-mono font-bold shrink-0">{t('announcements.atmosphere')}</span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-muted)] block truncate">
                      {preset.badgeText || t('announcements.alertActive')} • {preset.effectType}
                    </span>
                  </div>

                  <div
                    className="h-2 w-full rounded-full"
                    style={{ background: preset.backgroundValue }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* LISTADO DE MIS PLANTILLAS PERSONALIZADAS */}
          {selectedCategory === 'CUSTOM' && (
            <div>
              {customPresets.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[var(--border-subtle)] rounded-[8px] bg-[var(--bg-surface)] space-y-3">
                  <BookmarkPlus className="w-8 h-8 mx-auto text-[var(--text-muted)]" />
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('announcements.noCustomTemplates')}</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
                      Personaliza los colores, textos, efectos o programación de tu banner y pulsa en "Guardar como Plantilla" para reutilizarlo cuando quieras.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSavePresetModalOpen(true)}
                    className="h-10 px-4 rounded-[6px] text-xs sm:text-sm font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm mt-1"
                  >
                    <BookmarkPlus className="w-4 h-4 text-amber-400" />
                    <span>{t('announcements.saveCurrentDesign')}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-4 gap-3">
                  {customPresets.map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset.id)}
                      className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] text-left transition-all duration-180 hover:-translate-y-0.5 active:translate-y-0 shadow-sm cursor-pointer flex flex-col justify-between gap-3 group relative"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 pr-6">
                          <span className="text-sm font-bold block truncate text-[var(--text-primary)] group-hover:text-amber-400 transition-colors">
                            {preset.name}
                          </span>
                          <span className="text-xs text-[var(--text-muted)] block truncate">
                            {preset.badgeText || t('announcements.alertActive')} • {preset.effectType}
                          </span>
                        </div>

                        {/* Botón Eliminar Plantilla */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomPreset(preset.id, preset.name, e)}
                          className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors absolute top-3 right-3 cursor-pointer"
                          title={t('announcements.deleteThisTemplate')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div
                        className="h-2 w-full rounded-full"
                        style={{ background: preset.backgroundValue }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* CUSTOMIZATION STUDIO TABS */}
        <div className="rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm overflow-hidden">
          {/* Tab Navigation: Botones con tamaño generoso y estilo outline */}
          <div className="flex items-center gap-2.5 p-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`h-10 sm:h-11 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-semibold transition-all flex items-center gap-2.5 cursor-pointer border shrink-0 ${
                activeTab === 'content'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <Type className="w-4 h-4" />
              <span>1. Contenido & Textos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('visuals')}
              className={`h-10 sm:h-11 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-semibold transition-all flex items-center gap-2.5 cursor-pointer border shrink-0 ${
                activeTab === 'visuals'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>2. Fondos & Efectos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('media')}
              className={`h-10 sm:h-11 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-semibold transition-all flex items-center gap-2.5 cursor-pointer border shrink-0 ${
                activeTab === 'media'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>3. Multimedia & GIFs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`h-10 sm:h-11 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-semibold transition-all flex items-center gap-2.5 cursor-pointer border shrink-0 ${
                activeTab === 'schedule'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>{t('announcements.scheduleSection')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`h-10 sm:h-11 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-semibold transition-all flex items-center gap-2.5 cursor-pointer border shrink-0 ${
                activeTab === 'rules'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>5. Audiencia & Cierre</span>
            </button>
          </div>

          <div className="p-5 sm:p-6">
            {/* TAB 1: CONTENIDO & TEXTOS */}
            {activeTab === 'content' && (
              <div className="space-y-5">
                {/* Mensaje Principal */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.mainMessage')}</label>
                  <input
                    type="text"
                    value={formData.message || ''}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={t('announcements.messagePlaceholder')}
                    className="w-full h-10 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                  />
                  <p className="text-[11px] text-[var(--text-muted)]">{t('announcements.mainMessageDesc')}</p>
                </div>

                {/* Insignia / Badge */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[var(--border-subtle)]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.badgeText')}</label>
                    <input
                      type="text"
                      value={formData.badgeText || ''}
                      onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                      placeholder={t('announcements.badgePlaceholder')}
                      className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.badgeBackground')}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.badgeBgColor || '#ff4d4f'}
                        onChange={(e) => setFormData({ ...formData, badgeBgColor: e.target.value })}
                        className="w-9 h-9 rounded-[6px] border border-[var(--border-subtle)] cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={formData.badgeBgColor || '#ff4d4f'}
                        onChange={(e) => setFormData({ ...formData, badgeBgColor: e.target.value })}
                        className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.badgeTextColour')}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.badgeTextColor || '#ffffff'}
                        onChange={(e) => setFormData({ ...formData, badgeTextColor: e.target.value })}
                        className="w-9 h-9 rounded-[6px] border border-[var(--border-subtle)] cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={formData.badgeTextColor || '#ffffff'}
                        onChange={(e) => setFormData({ ...formData, badgeTextColor: e.target.value })}
                        className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Botón de Acción (CTA) */}
                <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.ctaButton')}</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">{t('announcements.buttonText')}</label>
                      <input
                        type="text"
                        value={formData.ctaText || ''}
                        onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                        placeholder={t('announcements.buttonPlaceholder')}
                        className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">{t('announcements.destinationUrl')}</label>
                      <input
                        type="text"
                        value={formData.ctaUrl || ''}
                        onChange={(e) => setFormData({ ...formData, ctaUrl: e.target.value })}
                        placeholder={t('announcements.urlPlaceholder')}
                        className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">{t('announcements.buttonBackground')}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.ctaBgColor || '#ffffff'}
                          onChange={(e) => setFormData({ ...formData, ctaBgColor: e.target.value })}
                          className="w-9 h-9 rounded-[6px] border border-[var(--border-subtle)] cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={formData.ctaBgColor || '#ffffff'}
                          onChange={(e) => setFormData({ ...formData, ctaBgColor: e.target.value })}
                          className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">{t('announcements.buttonText')}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.ctaTextColor || '#0ba360'}
                          onChange={(e) => setFormData({ ...formData, ctaTextColor: e.target.value })}
                          className="w-9 h-9 rounded-[6px] border border-[var(--border-subtle)] cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={formData.ctaTextColor || '#0ba360'}
                          onChange={(e) => setFormData({ ...formData, ctaTextColor: e.target.value })}
                          className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: FONDOS & EFECTOS FESTIVOS */}
            {activeTab === 'visuals' && (
              <div className="space-y-5">
                {/* Selector de Efectos de Temporada */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.seasonalEffect')}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {EFFECT_OPTIONS.map((eff) => (
                      <button
                        key={eff.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, effectType: eff.id })}
                        className={`p-3 rounded-[6px] border text-left transition-all duration-180 cursor-pointer flex flex-col justify-between gap-1 ${
                          formData.effectType === eff.id
                            ? 'bg-[#FF634A]/10 border-[#FF634A] text-[#FF634A] shadow-xs'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="text-xs font-bold block truncate">{t(eff.label)}</span>
                        <span className="text-[10px] text-[var(--text-muted)] block truncate">{t(eff.desc)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Switch de Atmósfera Global en Toda la Web */}
                <div className="flex items-center justify-between p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <div className="space-y-0.5 pr-4">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-[var(--text-primary)]">{t('announcements.extendEffectSiteWide')}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">{t('announcements.extendEffectDesc')}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        enableGlobalAtmosphere: formData.enableGlobalAtmosphere === false ? true : false,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      formData.enableGlobalAtmosphere !== false ? 'bg-amber-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        formData.enableGlobalAtmosphere !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Tipo de Fondo */}
                <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.presetGradients')}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {PRESET_GRADIENTS.map((grad) => (
                      <button
                        key={grad.name}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            backgroundType: 'GRADIENT',
                            backgroundValue: grad.value,
                          })
                        }
                        className="p-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] text-left space-y-1.5 transition-all cursor-pointer"
                      >
                        <div
                          className="h-5 w-full rounded-[4px] shadow-xs"
                          style={{ background: grad.value }}
                        />
                        <span className="text-[11px] font-medium block truncate text-[var(--text-secondary)]">
                          {t(grad.name)}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-[11px] font-semibold text-[var(--text-muted)]">{t('announcements.backgroundCss')}</label>
                    <input
                      type="text"
                      value={formData.backgroundValue || ''}
                      onChange={(e) => setFormData({ ...formData, backgroundValue: e.target.value })}
                      placeholder={t('announcements.cssPlaceholder')}
                      className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MULTIMEDIA & GIFS */}
            {activeTab === 'media' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.uploadImageOrGif')}</label>
                  <div className="p-6 border border-dashed border-[var(--border-subtle)] rounded-[8px] bg-[var(--bg-surface)] text-center space-y-3">
                    <Upload className="w-7 h-7 mx-auto text-[var(--text-muted)]" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{t('announcements.uploadImageDesc')}</p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t('announcements.supportedFormats')}</p>
                    </div>

                    <label className="px-4 py-2 rounded-[6px] text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-sm">
                      <Upload className="w-3.5 h-3.5 text-sky-400" />
                      <span>{uploadingMedia ? 'Subiendo...' : 'Seleccionar Archivo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={uploadingMedia}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-subtle)]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.iconPosition')}</label>
                    <CustomSelect
                      value={formData.mediaPosition || 'LEFT'}
                      onChange={(val) => setFormData({ ...formData, mediaPosition: val })}
                      options={[
                        { value: 'LEFT', label: t('announcements.noBadge') },
                        { value: 'RIGHT', label: t('announcements.posLeft') },
                      ]}
                      accentColor="cinnabar"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.directFileUrl')}</label>
                    <input
                      type="text"
                      value={formData.mediaUrl || ''}
                      onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                      placeholder="/api/announcements/media/... o https://..."
                      className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PROGRAMACIÓN & VIGENCIA (NUEVA SUITE COMPLETA) */}
            {activeTab === 'schedule' && (
              <div className="space-y-6">
                {/* TARJETA DE ESTADO EN VIVO */}
                <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)] font-heading">{t('announcements.validityStatus')}</span>
                        <span className={`px-2 py-0.5 rounded-[4px] text-[10.5px] font-mono font-bold border ${scheduleStatus.badgeClass}`}>
                          {scheduleStatus.title}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">
                        {scheduleStatus.message}
                      </p>
                    </div>
                  </div>

                  {(formData.startsAt || formData.endsAt) && (
                    <button
                      type="button"
                      onClick={clearScheduleDates}
                      className="px-3 py-1.5 rounded-[4px] text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
                    >
                      Limpiar Fechas (Indefinido)
                    </button>
                  )}
                </div>

                {/* BOTONES DE DURACIÓN RÁPIDA */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.setQuickDuration')}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <button
                      type="button"
                      onClick={clearScheduleDates}
                      className={`h-11 sm:h-12 px-3 rounded-[6px] text-xs sm:text-sm font-semibold border flex items-center justify-center text-center transition-all cursor-pointer ${
                        !formData.endsAt
                          ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-xs'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      Indefinido
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDurationDays(1)}
                      className="h-11 sm:h-12 px-3 rounded-[6px] text-xs sm:text-sm font-semibold border bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer flex items-center justify-center"
                    >{t('announcements.hours24')}</button>
                    <button
                      type="button"
                      onClick={() => applyDurationDays(3)}
                      className="h-11 sm:h-12 px-3 rounded-[6px] text-xs sm:text-sm font-semibold border bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer flex items-center justify-center"
                    >{t('announcements.days3')}</button>
                    <button
                      type="button"
                      onClick={() => applyDurationDays(7)}
                      className="h-11 sm:h-12 px-3 rounded-[6px] text-xs sm:text-sm font-semibold border bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer flex items-center justify-center"
                    >{t('announcements.days7')}</button>
                    <button
                      type="button"
                      onClick={() => applyDurationDays(15)}
                      className="h-11 sm:h-12 px-3 rounded-[6px] text-xs sm:text-sm font-semibold border bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer flex items-center justify-center"
                    >{t('announcements.days15')}</button>
                    <button
                      type="button"
                      onClick={() => applyDurationDays(30)}
                      className="h-11 sm:h-12 px-3 rounded-[6px] text-xs sm:text-sm font-semibold border bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer flex items-center justify-center"
                    >{t('announcements.days30')}</button>
                  </div>
                </div>

                {/* SELECTORES DE FECHA EXACTA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-subtle)]">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.startDateTime')}</label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, startsAt: new Date().toISOString() })}
                        className="text-xs text-[var(--text-muted)] hover:text-[#FF634A] transition-colors cursor-pointer font-medium"
                      >{t('announcements.startNow')}</button>
                    </div>
                    <input
                      type="datetime-local"
                      value={toDatetimeLocal(formData.startsAt)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          startsAt: fromDatetimeLocal(e.target.value),
                        })
                      }
                      className="w-full h-10 sm:h-11 px-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs sm:text-sm text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {formData.startsAt
                        ? `Inicio: ${formatReadableDate(t, locale, formData.startsAt)}`
                        : t('announcements.posRight')}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.endDateTime')}</label>
                      {formData.endsAt && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, endsAt: null })}
                          className="text-xs text-[var(--text-muted)] hover:text-rose-400 transition-colors cursor-pointer font-medium"
                        >{t('announcements.removeLimit')}</button>
                      )}
                    </div>
                    <input
                      type="datetime-local"
                      value={toDatetimeLocal(formData.endsAt)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          endsAt: fromDatetimeLocal(e.target.value),
                        })
                      }
                      className="w-full h-10 sm:h-11 px-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs sm:text-sm text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {formData.endsAt
                        ? `Fin: ${formatReadableDate(t, locale, formData.endsAt)}`
                        : t('announcements.noStartDate')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: AUDIENCIA & CIERRE */}
            {activeTab === 'rules' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Audiencia Objetivo */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                      Audiencia Objetivo
                    </label>
                    <CustomSelect
                      value={formData.targetAudience || 'ALL'}
                      onChange={(val) => setFormData({ ...formData, targetAudience: val })}
                      options={[
                        { value: 'ALL', label: t('announcements.noEndDate') },
                        { value: 'AUTHENTICATED', label: t('announcements.audienceAll') },
                        { value: 'GUEST', label: t('announcements.audienceRegistered') },
                        { value: 'ADMIN_ONLY', label: t('announcements.audienceGuests') },
                      ]}
                      accentColor="cinnabar"
                      triggerClassName="h-10 sm:h-11"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">{t('announcements.audienceDesc')}</p>
                  </div>

                  {/* Permitir Cerrar & Expiración */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.dismissBehaviour')}</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs sm:text-sm font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isClosable !== false}
                          onChange={(e) => setFormData({ ...formData, isClosable: e.target.checked })}
                          className="w-4 h-4 rounded text-[#FF634A]"
                        />
                        <span>{t('announcements.allowUsersToClose')}</span>
                      </label>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <span className="text-xs sm:text-sm text-[var(--text-secondary)]">{t('announcements.rememberDismissalFor')}</span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={formData.dismissExpiryDays || 7}
                        onChange={(e) =>
                          setFormData({ ...formData, dismissExpiryDays: parseInt(e.target.value, 10) || 7 })
                        }
                        className="w-24 h-10 px-3 text-center rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs sm:text-sm text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                      />
                      <span className="text-xs sm:text-sm text-[var(--text-muted)]">{t('announcements.days')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL: GUARDAR PLANTILLA PERSONALIZADA */}
      {isSavePresetModalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-opacity duration-200 ${
            isSavePresetModalClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in duration-200'
          }`}
          onClick={handleAttemptCloseSavePresetModal}
        >
          <div
            {...propsPreset}
            className={`w-full max-w-md rounded-[8px] border border-[var(--border-strong)] bg-[var(--popover-solid-bg)] text-[var(--text-primary)] shadow-2xl p-6 space-y-5 transition-all duration-200 ${
              isSavePresetModalClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100 animate-in zoom-in-95 duration-150'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[6px] bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <BookmarkPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold font-heading">{t('announcements.saveCustomTemplate')}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{t('announcements.saveCustomTemplateDesc')}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAttemptCloseSavePresetModal}
                className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mini Vista Previa de la Configuración Actual */}
            <div className="p-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">{t('announcements.designSummary')}</span>
              <div
                className="p-3 rounded-[5px] text-xs sm:text-sm flex items-center gap-2 overflow-hidden shadow-xs"
                style={{
                  background: formData.backgroundValue || '#18181b',
                  color: formData.textColor || '#ffffff',
                }}
              >
                {formData.badgeText && (
                  <span
                    className="px-2 py-0.5 rounded-[4px] text-[11px] font-bold shrink-0"
                    style={{
                      backgroundColor: formData.badgeBgColor || '#ff4d4f',
                      color: formData.badgeTextColor || '#ffffff',
                    }}
                  >
                    {formData.badgeText}
                  </span>
                )}
                <span className="truncate flex-1 font-medium">{formData.message}</span>
              </div>
            </div>

            <form onSubmit={handleSaveCustomPreset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.templateName')}{' '}<span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Ej. Oferta Especial Black Friday, Anuncio Anime Verano..."
                  className="w-full h-10 sm:h-11 px-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs sm:text-sm text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={handleAttemptCloseSavePresetModal}
                  className="h-10 px-4 rounded-[6px] text-xs sm:text-sm font-semibold border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >{t('common.cancel')}</button>
                <button
                  type="submit"
                  disabled={savingPreset || !newPresetName.trim()}
                  className="h-10 px-5 rounded-[6px] text-xs sm:text-sm font-bold bg-[#FF634A] text-white hover:bg-[#ff4d30] shadow-md shadow-[#FF634A]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingPreset ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                  <span>{t('announcements.saveTemplate')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE REEMPLAZAR CAMBIOS AL APLICAR PLANTILLA */}
      <ConfirmModal
        isOpen={showApplyPresetConfirm}
        title={t('announcements.unsavedAnnouncement')}
        description="Tienes modificaciones sin guardar en el diseño actual. Si aplicas esta plantilla, se reemplazarán todos tus ajustes por los de la plantilla seleccionada. ¿Deseas continuar?"
        confirmText="Reemplazar y Aplicar"
        cancelText="Conservar mis cambios"
        variant="warning"
        onConfirm={() => {
          setShowApplyPresetConfirm(false);
          if (pendingPresetId) {
            executeApplyPreset(pendingPresetId);
          }
        }}
        onClose={() => {
          setShowApplyPresetConfirm(false);
          setPendingPresetId(null);
        }}
      />

      {/* CONFIRMACIÓN DE DESCARTAR NOMBRE DE PLANTILLA */}
      <ConfirmModal
        isOpen={showDiscardPresetPrompt}
        title="Descartar plantilla"
        description="Has ingresado un nombre para la nueva plantilla. ¿Deseas descartar los cambios y salir?"
        confirmText="Descartar y Salir"
        cancelText="Continuar editando"
        variant="warning"
        onConfirm={() => {
          setShowDiscardPresetPrompt(false);
          closeSavePresetModalWithAnimation();
        }}
        onClose={() => setShowDiscardPresetPrompt(false)}
      />
    </div>
  );
}
