'use client';

import { useToast } from '@/components/ToastProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { PlexPinModal } from '@/components/PlexPinModal';
import { PlexServerModal } from '@/components/PlexServerModal';
import { JellyfinModal } from '@/components/JellyfinModal';
import { EmbyModal } from '@/components/EmbyModal';
import { AniListModal } from '@/components/AniListModal';
import { MalModal } from '@/components/MalModal';
import { KitsuModal } from '@/components/KitsuModal';
import { ScrobbleTesterModal } from '@/components/ScrobbleTesterModal';

interface ConnectionsModalsProps {
  hubData: any;
  loadHubData: (silent?: boolean) => Promise<void>;
  showPlexModal: boolean;
  setShowPlexModal: (show: boolean) => void;
  showServerModal: boolean;
  setShowServerModal: (show: boolean) => void;
  showJellyfinModal: boolean;
  setShowJellyfinModal: (show: boolean) => void;
  showEmbyModal: boolean;
  setShowEmbyModal: (show: boolean) => void;
  showAnilistModal: boolean;
  setShowAnilistModal: (show: boolean) => void;
  showMalModal: boolean;
  setShowMalModal: (show: boolean) => void;
  showKitsuModal: boolean;
  setShowKitsuModal: (show: boolean) => void;
  showTesterModal: boolean;
  setShowTesterModal: (show: boolean) => void;
}

export function ConnectionsModals({
  hubData,
  loadHubData,
  showPlexModal,
  setShowPlexModal,
  showServerModal,
  setShowServerModal,
  showJellyfinModal,
  setShowJellyfinModal,
  showEmbyModal,
  setShowEmbyModal,
  showAnilistModal,
  setShowAnilistModal,
  showMalModal,
  setShowMalModal,
  showKitsuModal,
  setShowKitsuModal,
  showTesterModal,
  setShowTesterModal,
}: ConnectionsModalsProps) {
  const { showToast } = useToast();
  const { t } = useI18n();

  return (
    <>
      {/* MODALS */}
      {showPlexModal && (
        <PlexPinModal
          isOpen={showPlexModal}
          onClose={() => setShowPlexModal(false)}
          onSuccess={() => {
            setShowPlexModal(false);
            loadHubData(true);
            showToast(t('connections.plexLinked'), 'success');
          }}
        />
      )}

      {showServerModal && (
        <PlexServerModal
          isOpen={showServerModal}
          onClose={() => setShowServerModal(false)}
          onSuccess={() => {
            setShowServerModal(false);
            loadHubData(true);
          }}
          currentServerName={hubData?.plex?.serverName}
          currentServerUrl={hubData?.plex?.serverUrl}
        />
      )}

      {showJellyfinModal && (
        <JellyfinModal
          isOpen={showJellyfinModal}
          onClose={() => setShowJellyfinModal(false)}
          onSuccess={() => {
            setShowJellyfinModal(false);
            loadHubData(true);
          }}
        />
      )}

      {showEmbyModal && (
        <EmbyModal
          isOpen={showEmbyModal}
          onClose={() => setShowEmbyModal(false)}
          onSuccess={() => {
            setShowEmbyModal(false);
            loadHubData(true);
          }}
        />
      )}

      {showAnilistModal && (
        <AniListModal
          isOpen={showAnilistModal}
          onClose={() => setShowAnilistModal(false)}
          onSuccess={() => {
            setShowAnilistModal(false);
            loadHubData(true);
            showToast(t('connections.aniListLinked'), 'success');
          }}
        />
      )}

      {showMalModal && (
        <MalModal
          isOpen={showMalModal}
          onClose={() => setShowMalModal(false)}
          onSuccess={() => {
            setShowMalModal(false);
            loadHubData(true);
            showToast(t('connections.malLinked'), 'success');
          }}
        />
      )}

      {showKitsuModal && (
        <KitsuModal
          isOpen={showKitsuModal}
          onClose={() => setShowKitsuModal(false)}
          onSuccess={() => {
            setShowKitsuModal(false);
            loadHubData(true);
            showToast(t('connections.kitsuLinked'), 'success');
          }}
        />
      )}

      {showTesterModal && (
        <ScrobbleTesterModal
          isOpen={showTesterModal}
          onClose={() => setShowTesterModal(false)}
          onSuccess={() => {
            setShowTesterModal(false);
            loadHubData(true);
          }}
        />
      )}
    </>
  );
}
