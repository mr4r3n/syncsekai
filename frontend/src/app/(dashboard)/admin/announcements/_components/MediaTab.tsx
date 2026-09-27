'use client';

import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { AnnouncementData } from '@/components/AnnouncementBanner';
import { CustomSelect } from '@/components/CustomSelect';
import { api } from '@/lib/api';

interface MediaTabProps {
  activeTab: string;
  formData: AnnouncementData;
  setFormData: React.Dispatch<React.SetStateAction<AnnouncementData>>;
  showToast: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  t: (key: string, values?: any) => string;
}

export function MediaTab({
  activeTab,
  formData,
  setFormData,
  showToast,
  t,
}: MediaTabProps) {
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      showToast(t('announcements.fileTooLarge'), 'error');
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
      showToast(t('announcements.fileUploaded'), 'success');
    } catch (err: any) {
      showToast(err.message || t('announcements.uploadFileError'), 'error');
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  };

  return (
    <>
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
                        { value: 'LEFT', label: t('announcements.posLeft') },
                        { value: 'RIGHT', label: t('announcements.posRight') },
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
    </>
  );
}
