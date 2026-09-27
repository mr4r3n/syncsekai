'use client';

import React from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import type { MediaItem } from './types';

interface MediaModalsProps {
  deleteModalOpen: boolean;
  setDeleteModalOpen: (open: boolean) => void;
  itemToDelete: MediaItem | null;
  handleConfirmDelete: () => void;
  purgeModalOpen: boolean;
  setPurgeModalOpen: (open: boolean) => void;
  isPurging: boolean;
  handleConfirmPurge: () => void;
  purgeOrphansModalOpen: boolean;
  setPurgeOrphansModalOpen: (open: boolean) => void;
  totalOrphans: number;
  isPurgingOrphans: boolean;
  handleConfirmPurgeOrphans: () => void;
  t: (key: string, values?: any) => string;
}

export function MediaModals({
  deleteModalOpen,
  setDeleteModalOpen,
  itemToDelete,
  handleConfirmDelete,
  purgeModalOpen,
  setPurgeModalOpen,
  isPurging,
  handleConfirmPurge,
  purgeOrphansModalOpen,
  setPurgeOrphansModalOpen,
  totalOrphans,
  isPurgingOrphans,
  handleConfirmPurgeOrphans,
  t,
}: MediaModalsProps) {
  return (
    <>
      {/* CONFIRM INDIVIDUAL DELETION MODAL */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title={t('admin.confirmDeleteMediaFile')}
        description={t('admin.confirmDeleteMediaDesc', { title: itemToDelete?.titleEnglish || itemToDelete?.titleRomaji || itemToDelete?.filename })}
        confirmText={t('admin.deleteFile')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModalOpen(false)}
      />

      {/* MODAL CONFIRMAR PURGA COMPLETA */}
      <ConfirmModal
        isOpen={purgeModalOpen}
        title={t('admin.confirmPurgeCache')}
        description={t('admin.confirmPurgeDesc')}
        confirmText={t('admin.purgeAll')}
        cancelText={t('common.cancel')}
        variant="warning"
        loading={isPurging}
        onConfirm={handleConfirmPurge}
        onClose={() => setPurgeModalOpen(false)}
      />

      {/* CONFIRM ORPHAN COVERS CLEANUP MODAL */}
      <ConfirmModal
        isOpen={purgeOrphansModalOpen}
        title={t('admin.confirmCleanOrphans')}
        description={t('admin.confirmCleanOrphansDesc', { count: totalOrphans })}
        confirmText={t('admin.cleanOrphans')}
        cancelText={t('common.cancel')}
        variant="warning"
        loading={isPurgingOrphans}
        onConfirm={handleConfirmPurgeOrphans}
        onClose={() => setPurgeOrphansModalOpen(false)}
      />
    </>
  );
}
