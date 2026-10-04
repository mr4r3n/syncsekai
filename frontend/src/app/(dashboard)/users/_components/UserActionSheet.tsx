import React from 'react';
import { Edit3, Shield, Unlock, Lock, Trash2 } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { getAvatarSrc } from './utils';

interface UserActionSheetProps {
  activeUserMenuId: string | null;
  setActiveUserMenuId: (id: string | null) => void;
  /** The users on screen: the sheet opens from one of their rows. */
  pageUsers: any[];
  handleOpenEdit: (u: any) => void;
  handleToggleRole: (userId: string, currentRole: string) => void;
  handleToggleBlock: (userId: string, currentSuspended: boolean, username: string) => void;
  setDeletingUser: (u: any) => void;
  t: (key: string, params?: any) => string;
}

export function UserActionSheet({
  activeUserMenuId,
  setActiveUserMenuId,
  pageUsers,
  handleOpenEdit,
  handleToggleRole,
  handleToggleBlock,
  setDeletingUser,
  t,
}: UserActionSheetProps) {
  {/* NATIVE MOBILE BOTTOM SHEET FOR USER OPTIONS */}
  return (
    <>
      {(() => {
        const selectedUser = pageUsers.find((u: any) => u.id === activeUserMenuId);
        if (!selectedUser) return null;
        const isSuspended = selectedUser.permissions?.isSuspended;
        const avatarSrc = getAvatarSrc(selectedUser.avatarUrl);

        return (
          <BottomSheet
            isOpen={!!activeUserMenuId}
            onClose={() => setActiveUserMenuId(null)}
            title={selectedUser.username}
            subtitle={selectedUser.email}
            headerImage={
              avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={selectedUser.username}
                  className="w-10 h-10 rounded-[8px] object-cover border border-[var(--border-subtle)] shadow-sm shrink-0 bg-[var(--bg-app)]"
                />
              ) : (
                <div className="w-10 h-10 rounded-[8px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] flex items-center justify-center font-bold text-sm border border-[var(--nav-active-border)] shrink-0">
                  {selectedUser.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )
            }
            headerBadge={
              <span
                className={`px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-bold ${
                  selectedUser.role === 'ADMIN'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'badge-pill'
                }`}
              >
                {selectedUser.role}
              </span>
            }
            actions={[
              {
                label: t('users.editDataAndPermissions'),
                sublabel: t('users.editDataDesc'),
                icon: Edit3,
                iconColor: 'text-[var(--accent-text)]',
                onClick: () => handleOpenEdit(selectedUser),
              },
              {
                label: t('users.changeRoleTo', { role: selectedUser.role === 'ADMIN' ? 'USER' : 'ADMIN' }),
                sublabel:
                  selectedUser.role === 'ADMIN'
                    ? t('users.revokeAdmin')
                    : t('users.grantFullPermissions'),
                icon: Shield,
                iconColor: 'text-purple-400',
                onClick: () => handleToggleRole(selectedUser.id, selectedUser.role),
              },
              {
                label: isSuspended ? t('users.unblockAccount') : t('users.blockAccountAccess'),
                sublabel: isSuspended
                  ? t('users.restoreLoginAndSync')
                  : t('users.suspendAccessNow'),
                icon: isSuspended ? Unlock : Lock,
                variant: isSuspended ? 'success' : 'warning',
                onClick: () =>
                  handleToggleBlock(selectedUser.id, isSuspended, selectedUser.username),
              },
              {
                label: t('users.deleteUserPermanentlyTitle'),
                sublabel: t('users.deleteUserPermanentlyDesc'),
                icon: Trash2,
                variant: 'danger',
                onClick: () => setDeletingUser(selectedUser),
              },
            ]}
          />
        );
      })()}
    </>
  );
}
