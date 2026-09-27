'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Topbar } from '@/components/Topbar';
import { AnnouncementData } from '@/components/AnnouncementBanner';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { Loader2 } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useModalA11y } from '@/components/useModalA11y';
import { AnnouncementStudioHeader } from './_components/AnnouncementStudioHeader';
import { AnnouncementPreview } from './_components/AnnouncementPreview';
import { TemplateGallerySection } from './_components/TemplateGallerySection';
import { StudioTabBar } from './_components/StudioTabBar';
import { ContentTab } from './_components/ContentTab';
import { VisualsTab } from './_components/VisualsTab';
import { MediaTab } from './_components/MediaTab';
import { ScheduleTab } from './_components/ScheduleTab';
import { RulesTab } from './_components/RulesTab';
import { SavePresetModal } from './_components/SavePresetModal';

export default function AdminAnnouncementsPage() {
  const { showToast, showUndoToast } = useToast();
  const { isCollapsed } = useSidebar();
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    badgeText: t('announcements.sampleBadge'),
    badgeBgColor: '#e53935',
    badgeTextColor: '#ffffff',
    message: t('announcements.sampleMessage'),
    mediaType: 'NONE',
    mediaUrl: null,
    mediaPosition: 'LEFT',
    backgroundType: 'GRADIENT',
    backgroundValue: 'linear-gradient(90deg, #1b4332 0%, #2d6a4f 50%, #b7094c 100%)',
    textColor: '#ffffff',
    effectType: 'SNOWFLAKES',
    enableGlobalAtmosphere: true,
    ctaText: t('announcements.sampleCta'),
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
      showToast(err.message || t('announcements.loadConfigError'), 'error');
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
      showToast(res.message || t('announcements.alertSaved'), 'success');
      if (res.announcement) {
        setFormData(res.announcement);
        setInitialFormData(JSON.stringify(res.announcement));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('plexsync:announcement-updated', { detail: res.announcement }));
        }
      }
    } catch (err: any) {
      showToast(err.message || t('announcements.saveChangesError'), 'error');
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
      showToast(err.message || t('announcements.toggleStateError'), 'error');
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
      showToast(err.message || t('announcements.applyTemplateError'), 'error');
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
      showToast(t('announcements.writeTemplateName'), 'error');
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
      showToast(err.message || t('announcements.saveTemplateError'), 'error');
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeleteCustomPreset = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const plantilla = customPresets.find((p) => p.id === id);
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
    showUndoToast(t('common.deletingItem', { name }), {
      alDeshacer: () => setCustomPresets((prev) => (plantilla ? [...prev, plantilla] : prev)),
      alExpirar: async () => {
        try {
          await api.announcements.deleteCustomPreset(id);
          showToast(t('announcements.presetDeleted', { name }), 'info');
        } catch (err: any) {
          setCustomPresets((prev) => (plantilla ? [...prev, plantilla] : prev));
          showToast(err.message || t('announcements.deleteTemplateError'), 'error');
        }
      },
    });
  };


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

      <AnnouncementStudioHeader
        formData={formData}
        handleToggleActive={handleToggleActive}
        setIsSavePresetModalOpen={setIsSavePresetModalOpen}
        handleSave={handleSave}
        saving={saving}
        isDirty={isDirty}
        t={t}
      />

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6 min-w-0">
        <AnnouncementPreview
          formData={formData}
          previewMode={previewMode}
          setPreviewMode={setPreviewMode}
          t={t}
        />

        <TemplateGallerySection
          presets={presets}
          customPresets={customPresets}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          handleApplyPreset={handleApplyPreset}
          handleDeleteCustomPreset={handleDeleteCustomPreset}
          setIsSavePresetModalOpen={setIsSavePresetModalOpen}
          t={t}
        />

        {/* CUSTOMIZATION STUDIO TABS */}
        <div className="rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm overflow-hidden">
          <StudioTabBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            t={t}
          />

          <div className="p-5 sm:p-6">
            <ContentTab
              activeTab={activeTab}
              formData={formData}
              setFormData={setFormData}
              t={t}
            />

            <VisualsTab
              activeTab={activeTab}
              formData={formData}
              setFormData={setFormData}
              t={t}
            />

            <MediaTab
              activeTab={activeTab}
              formData={formData}
              setFormData={setFormData}
              showToast={showToast}
              t={t}
            />

            <ScheduleTab
              activeTab={activeTab}
              formData={formData}
              setFormData={setFormData}
              showToast={showToast}
              t={t}
              locale={locale}
            />

            <RulesTab
              activeTab={activeTab}
              formData={formData}
              setFormData={setFormData}
              t={t}
            />
          </div>
        </div>
      </main>

      <SavePresetModal
        isSavePresetModalOpen={isSavePresetModalOpen}
        isSavePresetModalClosing={isSavePresetModalClosing}
        handleAttemptCloseSavePresetModal={handleAttemptCloseSavePresetModal}
        propsPreset={propsPreset}
        formData={formData}
        handleSaveCustomPreset={handleSaveCustomPreset}
        newPresetName={newPresetName}
        setNewPresetName={setNewPresetName}
        savingPreset={savingPreset}
        t={t}
      />

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
