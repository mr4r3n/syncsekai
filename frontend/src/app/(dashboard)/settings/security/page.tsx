'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/ToastProvider';
import { useModalA11y } from '@/components/useModalA11y';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Shield,
  Loader2,
} from 'lucide-react';
import { PasswordCard } from './_components/PasswordCard';
import { TwoFactorCard } from './_components/TwoFactorCard';
import { BackupCodesCard } from './_components/BackupCodesCard';
import { SocialAccountsCard } from './_components/SocialAccountsCard';
import { ActiveSessionsSection } from './_components/ActiveSessionsSection';
import { DangerZoneSection } from './_components/DangerZoneSection';
import { AccountDeletionModal } from './_components/AccountDeletionModal';
import { BackupCodesModal } from './_components/BackupCodesModal';
import { useRouter } from 'next/navigation';





export default function SecuritySettingsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // 2FA
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorType, setTwoFactorType] = useState<'APP_TOTP' | 'EMAIL_OTP' | 'NONE'>('NONE');
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [emailOtpRequested, setEmailOtpRequested] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [loading2FA, setLoading2FA] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Sesiones Activas & Dispositivos
  const [sessions, setSessions] = useState<any[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [unlinkingSocial, setUnlinkingSocial] = useState<string | null>(null);

  // Emergency Recovery Codes (Backup Codes)
  const [backupStatus, setBackupStatus] = useState<{ hasBackupCodes: boolean; remainingCount: number; generatedAt: string | null } | null>(null);
  const [loadingBackupStatus, setLoadingBackupStatus] = useState(false);
  const [generatingBackup, setGeneratingBackup] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupStep, setBackupStep] = useState<'VIEW' | 'VERIFY' | 'SUCCESS'>('VIEW');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [challengeIndex, setChallengeIndex] = useState<number>(0);
  const [challengeNumber, setChallengeNumber] = useState<number>(1);
  const [verifyCodeInput, setVerifyCodeInput] = useState<string>('');
  const [verifyingBackup, setVerifyingBackup] = useState(false);
  const [copiedAllCodes, setCopiedAllCodes] = useState(false);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // --- DANGER ZONE: ACCOUNT DELETION (2 PHASES & 24H GRACE) ---
  const [showDeletionModal, setShowDeletionModal] = useState(false);

  // Dialog semantics and focus management for modals in this view.
  const { dialogProps: deleteProps } = useModalA11y(
    showDeletionModal,
    useCallback(() => setShowDeletionModal(false), []),
  );
  const { dialogProps: backupProps } = useModalA11y(
    backupModalOpen,
    useCallback(() => setBackupModalOpen(false), []),
  );
  const [deletePasswordInput, setDeletePasswordInput] = useState('');
  const [delete2FaInput, setDelete2FaInput] = useState('');
  const [requestingDeletion, setRequestingDeletion] = useState(false);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');

      if (error) {
        if (error.includes('NOT_CONFIGURED')) {
          const provName = error.split('_')[0];
          showToast(t('security.providerNotConfiguredEnv', { provider: provName }), 'info');
        } else if (error === 'ACCESS_DENIED') {
          showToast(t('security.linkCancelled'), 'info');
        } else {
          showToast(`${t('security.linkError')} ` + error, 'error');
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    }

    loadSecurityProfile();
  }, []);



  const handleRequestDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userProfile?.hasPassword && !deletePasswordInput) {
      showToast(t('security.enterCurrentPassword'), 'error');
      return;
    }
    if (userProfile?.twoFactorEnabled && !delete2FaInput.trim()) {
      showToast(t('security.enterTwoFactorCode'), 'error');
      return;
    }

    setRequestingDeletion(true);
    try {
      const res = await api.auth.requestAccountDeletion({
        password: deletePasswordInput,
        twoFactorCode: delete2FaInput,
      });
      showToast(res.message, 'success');
      setShowDeletionModal(false);
      setDeletePasswordInput('');
      setDelete2FaInput('');
    } catch (err: any) {
      showToast(err.message || t('security.deletionRequestError'), 'error');
    } finally {
      setRequestingDeletion(false);
    }
  };

  const handleCancelDeletion = async () => {
    setCancellingDeletion(true);
    try {
      const res = await api.auth.cancelAccountDeletion();
      showToast(res.message, 'success');
      setUserProfile((prev: any) => ({ ...prev, deletionScheduledAt: null }));
    } catch (err: any) {
      showToast(err.message || t('security.cancelDeletionError'), 'error');
    } finally {
      setCancellingDeletion(false);
    }
  };

  const loadSecurityProfile = async () => {
    try {
      setLoading(true);
      const [userRes, sessionsRes] = await Promise.allSettled([
        api.auth.me(),
        api.auth.getSessions(),
      ]);

      if (userRes.status === 'fulfilled') {
        const user = userRes.value?.user || userRes.value;
        if (!user) {
          router.push('/login');
          return;
        }
        setUserProfile(user);
        setTwoFactorEnabled(!!user.twoFactorEnabled);
        setTwoFactorType(user.twoFactorType || (user.twoFactorEnabled ? 'APP_TOTP' : 'NONE'));
      }

      if (sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value)) {
        setSessions(sessionsRes.value);
      }

      await loadBackupStatus();
    } catch (e: any) {
      showToast(e.message || t('security.loadSecurityProfileError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadBackupStatus = async () => {
    try {
      setLoadingBackupStatus(true);
      const res = await api.auth.getBackupCodesStatus();
      setBackupStatus(res);
    } catch {
      // Ignore
    } finally {
      setLoadingBackupStatus(false);
    }
  };

  const handleStartGenerateBackup = async () => {
    try {
      setGeneratingBackup(true);
      const res = await api.auth.generateBackupCodes();
      setGeneratedCodes(res.codes);
      setChallengeIndex(res.challengeIndex);
      setChallengeNumber(res.challengeNumber);
      setVerifyCodeInput('');
      setBackupStep('VIEW');
      setBackupModalOpen(true);
    } catch (err: any) {
      showToast(err.message || t('security.generateCodesError'), 'error');
    } finally {
      setGeneratingBackup(false);
    }
  };

  const handleCopyAllCodes = () => {
    if (generatedCodes.length === 0) return;
    const text = [
      '=========================================',
      `  ${t('security.fileHeader')}`,
      '=========================================',
      t('security.backupFileUser', { user: userProfile?.username || t('common.user') }),
      t('security.backupFileDate', { date: new Date().toLocaleString() }),
      '',
      t('security.fileLineOnce'),
      t('security.fileLineStore'),
      '',
      ...generatedCodes.map((code, idx) => `[${idx + 1}] ${code}`),
      '',
      '=========================================',
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAllCodes(true);
    showToast(t('security.codesCopied'), 'info');
    setTimeout(() => setCopiedAllCodes(false), 2500);
  };

  const handleDownloadCodes = () => {
    if (generatedCodes.length === 0) return;
    const text = [
      '=========================================',
      `  ${t('security.fileHeader')}`,
      '=========================================',
      t('security.backupFileUser', { user: userProfile?.username || t('common.user') }),
      t('security.backupFileDate', { date: new Date().toLocaleString() }),
      '',
      t('security.onceOnlyPart1'),
      t('security.onceOnlyPart2'),
      '',
      ...generatedCodes.map((code, idx) => `[${idx + 1}] ${code}`),
      '',
      '=========================================',
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plexsync-codigos-emergencia-${userProfile?.username || 'user'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t('security.codesFileDownloaded'), 'success');
  };

  const handleVerifyAndSaveBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCodeInput.trim()) {
      showToast(t('security.enterRequestedCode'), 'error');
      return;
    }
    try {
      setVerifyingBackup(true);
      const res = await api.auth.verifyAndSaveBackupCodes({
        codes: generatedCodes,
        challengeIndex,
        confirmedCode: verifyCodeInput.trim().toUpperCase(),
      });
      setBackupStep('SUCCESS');
      await loadBackupStatus();
      showToast(res.message || t('security.recoveryCodesEnabled'), 'success');
    } catch (err: any) {
      showToast(err.message || t('security.wrongCode'), 'error');
    } finally {
      setVerifyingBackup(false);
    }
  };

  const handleUnlinkSocial = async (provider: 'google' | 'discord') => {
    try {
      setUnlinkingSocial(provider);
      if (provider === 'google') {
        await api.auth.unlinkGoogle();
        showToast(t('security.googleUnlinked'), 'success');
      } else {
        await api.auth.unlinkDiscord();
        showToast(t('security.discordUnlinked'), 'success');
      }
      await loadSecurityProfile();
    } catch (err: any) {
      showToast(err.message || t('security.unlinkSocialError'), 'error');
    } finally {
      setUnlinkingSocial(null);
    }
  };

  const handleLinkSocial = async (provider: 'google' | 'discord') => {
    showToast(t('security.redirectingSocialLink', { provider: provider === 'google' ? 'Google' : 'Discord' }), 'info');
    try {
      const result = provider === 'google'
        ? await api.auth.startGoogleLink()
        : await api.auth.startDiscordLink();
      window.location.href = result.url;
    } catch (error: any) {
      showToast(error.message || t('security.couldNotStartLink'), 'error');
    }
  };

  const handleSavePassword = async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault();
    if ((userProfile?.hasPassword !== false && !currentPassword) || !newPassword) {
      showToast(t('security.enterCurrentAndNew'), 'error');
      return false;
    }
    if (newPassword.length < 12) {
      showToast(t('auth.newPasswordMinLength'), 'error');
      return false;
    }
    if (newPassword !== confirmPassword) {
      showToast(t('auth.passwordsDoNotMatch'), 'error');
      return false;
    }

    try {
      setSavingPassword(true);
      await api.auth.updatePassword({ currentPassword, newPassword });
      showToast(t('security.passwordUpdatedSignIn'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      router.replace('/login');
      return true;
    } catch (e: any) {
      showToast(e.message || t('security.updatePasswordError'), 'error');
      return false;
    } finally {
      setSavingPassword(false);
    }
  };

  // --- 2FA APP (TOTP) ---
  const handleStartTotpSetup = async () => {
    try {
      setLoading2FA(true);
      const res = await api.auth.generateTotp();
      setTotpSetupData({ secret: res.secret, qrCodeDataUrl: res.qrCodeDataUrl });
    } catch (e: any) {
      showToast(e.message || t('security.qrGenerateError'), 'error');
    } finally {
      setLoading2FA(false);
    }
  };

  const handleEnableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.trim().length !== 6 || !totpSetupData) {
      showToast(t('security.enterAppSixDigit'), 'error');
      return;
    }

    try {
      setLoading2FA(true);
      await api.auth.enableTotp({ token: totpCode.trim() });
      showToast(t('security.twoFactorAppEnabled'), 'success');
      setTwoFactorEnabled(true);
      setTwoFactorType('APP_TOTP');
      setTotpSetupData(null);
      setTotpCode('');
    } catch (e: any) {
      showToast(e.message || t('security.wrongTotp'), 'error');
    } finally {
      setLoading2FA(false);
    }
  };

  // --- 2FA EMAIL OTP ---
  const handleRequestEmailOtp = async () => {
    try {
      setLoading2FA(true);
      const res = await api.auth.requestEmailOtp();
      setEmailOtpRequested(true);
      showToast(res.message || t('security.otpSent'), 'success');
    } catch (e: any) {
      showToast(e.message || t('security.otpRequestError'), 'error');
    } finally {
      setLoading2FA(false);
    }
  };

  const handleEnableEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOtpCode || emailOtpCode.trim().length !== 6) {
      showToast(t('security.enterEmailSixDigit'), 'error');
      return;
    }

    try {
      setLoading2FA(true);
      await api.auth.enableEmailOtp({ code: emailOtpCode.trim() });
      showToast(t('security.twoFactorEmailEnabled'), 'success');
      setTwoFactorEnabled(true);
      setTwoFactorType('EMAIL_OTP');
      setEmailOtpRequested(false);
      setEmailOtpCode('');
    } catch (e: any) {
      showToast(e.message || t('security.wrongOrExpiredEmailCode'), 'error');
    } finally {
      setLoading2FA(false);
    }
  };

  // --- DESACTIVAR 2FA ---
  const handleDisable2Fa = () => {
    setConfirmModal({
      isOpen: true,
      title: t('security.disableTwoFactorQuestion'),
      description: t('security.disableTwoFactorDesc'),
      confirmText: t('security.disable2fa'),
      variant: 'warning',
      onConfirm: async () => {
        try {
          setLoading2FA(true);
          const password = userProfile?.hasPassword
            ? window.prompt(t('security.confirmYourPassword')) || ''
            : undefined;
          if (userProfile?.hasPassword && !password) return;

          if (twoFactorType === 'EMAIL_OTP') {
            await api.auth.requestEmailOtp();
          }
          const verificationCode = window.prompt(
            twoFactorType === 'EMAIL_OTP'
              ? t('security.enterEmailCode')
              : t('security.enterAppCode'),
          ) || '';
          if (!verificationCode) return;

          await api.auth.disable2Fa({ password, verificationCode });
          showToast(t('security.twoFactorDisabled'), 'info');
          setTwoFactorEnabled(false);
          setTwoFactorType('NONE');
          setTotpSetupData(null);
          setEmailOtpRequested(false);
        } catch (e: any) {
          showToast(e.message || t('security.disableTwoFactorError'), 'error');
        } finally {
          setLoading2FA(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // --- ACTIVE SESSIONS MANAGEMENT ---
  const handleRevokeSession = (sessionId: string, deviceName: string) => {
    setConfirmModal({
      isOpen: true,
      title: t('security.closeSessionQuestion'),
      description: t('security.confirmRevokeSessionDesc', { device: deviceName }),
      confirmText: t('security.signOut'),
      variant: 'danger',
      onConfirm: async () => {
        try {
          setRevokingId(sessionId);
          await api.auth.revokeSession(sessionId);
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          showToast(t('security.sessionRevoked'), 'success');
        } catch (e: any) {
          showToast(e.message || t('security.revokeSessionError'), 'error');
        } finally {
          setRevokingId(null);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleRevokeOtherSessions = () => {
    const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;
    if (otherSessionsCount === 0) {
      showToast(t('security.noOtherSessions'), 'info');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: t('security.closeAllOthersQuestion'),
      description: t('security.closeOthersDesc', { n: otherSessionsCount }),
      confirmText: t('security.closeNSessions', { n: otherSessionsCount }),
      variant: 'danger',
      onConfirm: async () => {
        try {
          setRevokingOthers(true);
          await api.auth.revokeOtherSessions();
          setSessions((prev) => prev.filter((s) => s.isCurrent));
          showToast(t('security.allOtherSessionsClosed'), 'success');
        } catch (e: any) {
          showToast(e.message || t('security.closeRemoteSessionsError'), 'error');
        } finally {
          setRevokingOthers(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const copySecret = () => {
    if (totpSetupData?.secret) {
      navigator.clipboard.writeText(totpSetupData.secret);
      setCopiedSecret(true);
      showToast(t('security.secretKeyCopied'), 'info');
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };



  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('topbar.settings')} currentLabel={t('security.securityTitle')} />

      {/* TOP HEADER (STATIC ON MOBILE, STICKY ON DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('security.securityTitle')}</h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('security.securitySubtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-8 min-w-0">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-text)]" />
            <span className="text-xs font-mono text-[var(--text-muted)]">{t('security.loadingProfile')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: PASSWORD & 2FA (7 COLS) */}
            <div className="xl:col-span-7 space-y-6">
              <PasswordCard
                handleSavePassword={handleSavePassword}
                currentPassword={currentPassword}
                setCurrentPassword={setCurrentPassword}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                savingPassword={savingPassword}
                hasPassword={userProfile?.hasPassword !== false}
                t={t}
              />

              <TwoFactorCard
                twoFactorEnabled={twoFactorEnabled}
                twoFactorType={twoFactorType}
                handleDisable2Fa={handleDisable2Fa}
                loading2FA={loading2FA}
                handleStartTotpSetup={handleStartTotpSetup}
                handleRequestEmailOtp={handleRequestEmailOtp}
                totpSetupData={totpSetupData}
                setTotpSetupData={setTotpSetupData}
                copySecret={copySecret}
                copiedSecret={copiedSecret}
                handleEnableTotp={handleEnableTotp}
                totpCode={totpCode}
                setTotpCode={setTotpCode}
                emailOtpRequested={emailOtpRequested}
                setEmailOtpRequested={setEmailOtpRequested}
                handleEnableEmailOtp={handleEnableEmailOtp}
                emailOtpCode={emailOtpCode}
                setEmailOtpCode={setEmailOtpCode}
                userProfile={userProfile}
                t={t}
              />

              <BackupCodesCard
                backupStatus={backupStatus}
                handleStartGenerateBackup={handleStartGenerateBackup}
                generatingBackup={generatingBackup}
                loadingBackupStatus={loadingBackupStatus}
                t={t}
              />
            </div>

            {/* COLUMNA DERECHA: CUENTAS SOCIALES (5 COLS) */}
            <div className="xl:col-span-5 space-y-6">
              <SocialAccountsCard
                userProfile={userProfile}
                handleUnlinkSocial={handleUnlinkSocial}
                unlinkingSocial={unlinkingSocial}
                handleLinkSocial={handleLinkSocial}
                t={t}
              />
            </div>

            <ActiveSessionsSection
              sessions={sessions}
              handleRevokeOtherSessions={handleRevokeOtherSessions}
              revokingOthers={revokingOthers}
              handleRevokeSession={handleRevokeSession}
              revokingId={revokingId}
              t={t}
            />

            <DangerZoneSection
              userProfile={userProfile}
              handleCancelDeletion={handleCancelDeletion}
              cancellingDeletion={cancellingDeletion}
              setDeletePasswordInput={setDeletePasswordInput}
              setDelete2FaInput={setDelete2FaInput}
              setShowDeletionModal={setShowDeletionModal}
              t={t}
            />
          </div>
        )}
      </main>

      <AccountDeletionModal
        showDeletionModal={showDeletionModal}
        deleteProps={deleteProps}
        setShowDeletionModal={setShowDeletionModal}
        userProfile={userProfile}
        handleRequestDeletion={handleRequestDeletion}
        deletePasswordInput={deletePasswordInput}
        setDeletePasswordInput={setDeletePasswordInput}
        delete2FaInput={delete2FaInput}
        setDelete2FaInput={setDelete2FaInput}
        requestingDeletion={requestingDeletion}
        t={t}
      />

      <BackupCodesModal
        backupModalOpen={backupModalOpen}
        backupProps={backupProps}
        backupStep={backupStep}
        setBackupModalOpen={setBackupModalOpen}
        generatedCodes={generatedCodes}
        handleCopyAllCodes={handleCopyAllCodes}
        copiedAllCodes={copiedAllCodes}
        handleDownloadCodes={handleDownloadCodes}
        setBackupStep={setBackupStep}
        handleVerifyAndSaveBackup={handleVerifyAndSaveBackup}
        challengeNumber={challengeNumber}
        verifyCodeInput={verifyCodeInput}
        setVerifyCodeInput={setVerifyCodeInput}
        verifyingBackup={verifyingBackup}
        t={t}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText || t('common.confirm')}
        cancelText={t('common.cancel')}
        variant={confirmModal.variant || 'danger'}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
