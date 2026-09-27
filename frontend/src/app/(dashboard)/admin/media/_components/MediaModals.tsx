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
      {/* MODAL CONFIRMAR ELIMINACIÓN INDIVIDUAL */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title={t('admin.confirmDeleteMediaFile')}
        description={`Estás a punto de eliminar "${itemToDelete?.titleEnglish || itemToDelete?.titleRomaji || itemToDelete?.filename}". Esta acción no se puede deshacer.`}
        confirmText="Eliminar Archivo"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModalOpen(false)}
      />

      {/* MODAL CONFIRMAR PURGA COMPLETA */}
      <ConfirmModal
        isOpen={purgeModalOpen}
        title={t('admin.confirmPurgeCache')}
        description="Se eliminarán todas las portadas descargadas localmente. La aplicación las descargará de nuevo según sea necesario cuando los usuarios exploren el catálogo o sintonicen animes."
        confirmText="Purgar Todo"
        cancelText="Cancelar"
        variant="warning"
        loading={isPurging}
        onConfirm={handleConfirmPurge}
        onClose={() => setPurgeModalOpen(false)}
      />

      {/* MODAL CONFIRMAR LIMPIEZA DE PORTADAS HUÉRFANAS */}
      <ConfirmModal
        isOpen={purgeOrphansModalOpen}
        title={t('admin.confirmCleanOrphans')}
        description={`Se eliminarán de forma segura las ${totalOrphans} portadas que ya no están vinculadas a ningún anime o historial en la base de datos, liberando almacenamiento sin afectar a tus animes activos.`}
        confirmText="Limpiar Huérfanas"
        cancelText="Cancelar"
        variant="warning"
        loading={isPurgingOrphans}
        onConfirm={handleConfirmPurgeOrphans}
        onClose={() => setPurgeOrphansModalOpen(false)}
      />
    </>
  );
}
