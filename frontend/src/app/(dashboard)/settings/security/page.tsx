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
  Key,
  Smartphone,
  Mail,
  QrCode,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  Save,
  Send,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Laptop,
  LogOut,
  Link2,
  Unlink,
  RefreshCw,
  X,
  Download,
  FileText,
  ShieldAlert,
  Trash2,
  Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// --- ICONOS VECTORIALES DE MARCAS Y CLIENTES ---
function ChromeBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C16.03 2 19.49 4.45 20.97 7.95L12 12V2Z" fill="#EA4335" />
      <path d="M20.97 7.95C21.63 9.17 22 10.54 22 12C22 17.18 18.06 21.43 13 21.96L8.8 14.68L12 12L20.97 7.95Z" fill="#FBBC04" />
      <path d="M13 21.96C12.67 21.99 12.34 22 12 22C6.48 22 2 17.52 2 12C2 8.57 3.73 5.54 6.38 3.75L9.6 9.32L12 12L8.8 14.68L13 21.96Z" fill="#34A853" />
      <path d="M6.38 3.75C7.94 2.65 9.89 2 12 2L12 12L9.6 9.32L6.38 3.75Z" fill="#EA4335" />
      <circle cx="12" cy="12" r="5" fill="#FFFFFF" />
      <circle cx="12" cy="12" r="3.7" fill="#1A73E8" />
    </svg>
  );
}

function WindowsBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#00A4EF">
      <path d="M0 3.449L9.75 2.1v9.451H0V3.449zm0 8.877h9.75v9.451L0 20.426v-8.1zm10.55-9.61L24 0v11.55H10.55V2.716zm0 9.61H24V24l-13.45-2.716v-8.958z" />
    </svg>
  );
}

function AppleBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.66-.81 1.11-1.94.99-3.07-1 .04-2.16.67-2.84 1.48-.59.69-1.12 1.83-.98 2.94 1.11.09 2.18-.58 2.83-1.35" />
    </svg>
  );
}

function FireTvBrandIcon({ className = "w-10 h-8" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <span className="font-black text-[#FF9900] tracking-tighter text-xs italic font-sans leading-none">
        fire<span className="text-white font-normal ml-0.5">tv</span>
      </span>
      <svg className="w-8 h-1.5 mt-0.5" viewBox="0 0 50 10" fill="none">
        <path d="M2 3C15 8 35 8 48 3" stroke="#FF9900" strokeWidth="3" strokeLinecap="round" />
        <path d="M44 1.5L48 3L45 5.5" fill="#FF9900" />
      </svg>
    </div>
  );
}

function PlexBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M7 4L15 12L7 20H11L19 12L11 4H7Z" fill="#E5A00D" />
    </svg>
  );
}

function SafariBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#006CFF" />
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="0.8" strokeDasharray="1 1" />
      <polygon points="12,4 14,12 12,20 10,12" fill="#FF3B30" />
      <polygon points="12,20 14,12 12,4 10,12" fill="#FFFFFF" opacity="0.9" />
      <circle cx="12" cy="12" r="1.5" fill="#006CFF" />
    </svg>
  );
}

function FirefoxBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#6C2BD9" />
      <path
        d="M12 3C7 3 4 7 4 12C4 16.4 7.6 20 12 20C16.4 20 20 16.4 20 12C20 8 17 5 15 5C14 6 14.5 7.5 13.5 8.5C12.5 9.5 11 9 10.5 8C10 7 10.5 5.5 12 3Z"
        fill="#FF7139"
      />
      <circle cx="12" cy="12" r="5" fill="#FFB703" />
      <circle cx="11" cy="11" r="3" fill="#006CFF" />
    </svg>
  );
}

function EdgeBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#0078D7" />
      <path
        d="M12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C15.5 20 18.5 17.5 19.5 14C19 14.5 18 15 17 15C14.24 15 12 12.76 12 10C12 7.5 13.5 5.5 15.5 4.5C14.5 4.2 13.3 4 12 4Z"
        fill="#00C7F2"
      />
      <path
        d="M17 10C17 13 14.5 15.5 11.5 15.5C9.5 15.5 8 14.5 7.5 13.5C8.5 17 12 19 15.5 18C18 17.2 19.5 15 19.5 12C19.5 9.5 18.5 8 17 7V10Z"
        fill="#50E6FF"
      />
    </svg>
  );
}

function AndroidBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#3DDC84">
      <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-4.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.72 2.24 12.88 2 12 2c-.88 0-1.72.24-2.64.63L7.88 1.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.3 1.3C6.71 4.34 5.5 6.02 5.5 8h13c0-1.98-1.21-3.66-2.97-4.84zM9 6c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
    </svg>
  );
}

function LinuxBrandIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#FCC624">
      <path d="M12 2C9.5 2 7.5 4 7.5 6.5C7.5 8 8 9.5 9 10.5C8 11.5 7 13 7 15C7 17.5 9 20 12 20C15 20 17 17.5 17 15C17 13 16 11.5 15 10.5C16 9.5 16.5 8 16.5 6.5C16.5 4 14.5 2 12 2Z" fill="#333333" />
      <circle cx="10.5" cy="6" r="1" fill="#FCC624" />
      <circle cx="13.5" cy="6" r="1" fill="#FCC624" />
      <ellipse cx="12" cy="7.5" rx="1.5" ry="1" fill="#E67E22" />
      <ellipse cx="12" cy="14" rx="3.5" ry="4" fill="#FFFFFF" />
      <path d="M6 19C7 19 8 18 8 17C8 16 7 15 6 15C5 15 4 16 4 17C4 18 5 19 6 19ZM18 19C19 19 20 18 20 17C20 16 19 15 18 15C17 15 16 16 16 17C16 18 17 19 18 19Z" fill="#E67E22" />
    </svg>
  );
}

type Traductor = (key: string, vars?: Record<string, string | number>) => string;

// Ayudante, no componente: recibe t en vez de usar el hook. Reutiliza las
// claves de tiempo relativo que ya existen en la seccion topbar.
function formatRelativeTime(t: Traductor, dateString: string | Date | undefined) {
  if (!dateString) return t('security.activeRecently');
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);

  if (diffSec < 60) return t('security.activeNow');
  if (diffSec < 3600) return t('topbar.minutesAgo', { mins: Math.floor(diffSec / 60) });
  if (diffSec < 86400) return t('topbar.hoursAgo', { hours: Math.floor(diffSec / 3600) });
  return t('topbar.daysAgo', { days: Math.floor(diffSec / 86400) });
}

function renderDeviceBrandIcon(iconType: string, browser: string, os: string) {
  const type = (iconType || '').toUpperCase();
  const b = (browser || '').toLowerCase();
  const o = (os || '').toLowerCase();

  if (type === 'CHROME' || b.includes('chrome')) return <ChromeBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'WINDOWS' || o.includes('windows')) return <WindowsBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'FIRETV' || o.includes('fire') || b.includes('fire')) return <FireTvBrandIcon className="w-10 h-8 shrink-0" />;
  if (type === 'PLEX' || b.includes('plex') || b.includes('pms') || b.includes('plexamp')) return <PlexBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'IOS' || o.includes('ios') || o.includes('iphone') || o.includes('ipad')) return <AppleBrandIcon className="w-8 h-8 shrink-0 text-white" />;
  if (type === 'SAFARI' || b.includes('safari') || o.includes('mac')) return <SafariBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'FIREFOX' || b.includes('firefox')) return <FirefoxBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'EDGE' || b.includes('edge')) return <EdgeBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'ANDROID' || o.includes('android')) return <AndroidBrandIcon className="w-8 h-8 shrink-0" />;
  if (type === 'LINUX' || o.includes('linux')) return <LinuxBrandIcon className="w-8 h-8 shrink-0" />;
  return <ChromeBrandIcon className="w-8 h-8 shrink-0" />;
}

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Contraseña
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

  // Códigos de Recuperación de Emergencia (Backup Codes)
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

  // Modal de Confirmación
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

  // --- ZONA DE PELIGRO: ELIMINACIÓN DE CUENTA (2 FASES & GRACIA 24H) ---
  const [showDeletionModal, setShowDeletionModal] = useState(false);

  // Semántica de diálogo y gestión de foco para los modales de esta vista.
  const { dialogProps: propsBorrado } = useModalA11y(
    showDeletionModal,
    useCallback(() => setShowDeletionModal(false), []),
  );
  const { dialogProps: propsRespaldo } = useModalA11y(
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
          showToast(`El proveedor ${provName} no está configurado aún en backend/.env`, 'info');
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
      `Usuario: ${userProfile?.username || 'Usuario'}`,
      `Fecha: ${new Date().toLocaleString()}`,
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
      `Usuario: ${userProfile?.username || 'Usuario'}`,
      `Fecha: ${new Date().toLocaleString()}`,
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
    showToast(`Redirigiendo a ${provider === 'google' ? 'Google' : 'Discord'} para vincular cuenta...`, 'info');
    try {
      const result = provider === 'google'
        ? await api.auth.startGoogleLink()
        : await api.auth.startDiscordLink();
      window.location.href = result.url;
    } catch (error: any) {
      showToast(error.message || t('security.couldNotStartLink'), 'error');
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      showToast(t('security.enterCurrentAndNew'), 'error');
      return;
    }
    if (newPassword.length < 12) {
      showToast(t('auth.newPasswordMinLength'), 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast(t('auth.passwordsDoNotMatch'), 'error');
      return;
    }

    try {
      setSavingPassword(true);
      await api.auth.updatePassword({ currentPassword, newPassword });
      showToast(t('security.passwordUpdatedSignIn'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      router.replace('/login');
    } catch (e: any) {
      showToast(e.message || t('security.updatePasswordError'), 'error');
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

  // --- GESTIÓN DE SESIONES ACTIVAS ---
  const handleRevokeSession = (sessionId: string, deviceName: string) => {
    setConfirmModal({
      isOpen: true,
      title: t('security.closeSessionQuestion'),
      description: `¿Cerrar sesión en "${deviceName}"? El dispositivo perderá el acceso inmediatamente.`,
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

      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
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
            {/* COLUMNA IZQUIERDA: CONTRASEÑA & 2FA (7 COLS) */}
            <div className="xl:col-span-7 space-y-6">
              {/* CARD 1: CAMBIO DE CONTRASEÑA */}
              <div className="glass-card p-6 sm:p-7 space-y-6">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('security.passwordSection')}</h2>
                    <p className="text-xs text-[var(--text-secondary)]">{t('security.updatePasswordDesc')}</p>
                  </div>
                </div>

                <form onSubmit={handleSavePassword} className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> {t('security.currentPassword')}
                    </label>
                    <input
                      type="password"
                      suppressHydrationWarning
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="glass-input"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('security.newPassword')}</label>
                      <input
                        type="password"
                        suppressHydrationWarning
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t('security.minSixChars')}
                        className="glass-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('security.confirmPassword')}</label>
                      <input
                        type="password"
                        suppressHydrationWarning
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t('auth.repeatNewPasswordPlaceholder')}
                        className="glass-input"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingPassword || !currentPassword || !newPassword}
                    className="btn-primary w-full py-2.5"
                  >
                    {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{t('security.updatePassword')}</span>
                  </button>
                </form>
              </div>

              {/* CARD 2: AUTENTICACIÓN EN DOS PASOS (2FA) */}
              <div className="glass-card p-6 sm:p-7 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('security.twoFactorSection')}</h2>
                        <span className={twoFactorEnabled ? 'badge-status-success' : 'badge-status-neutral'}>
                          {twoFactorEnabled ? t('security.enabledBadge') : t('security.disabledBadge')}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">{t('security.twoFactorDesc')}</p>
                    </div>
                  </div>

                  {twoFactorEnabled && (
                    <button
                      type="button"
                      onClick={handleDisable2Fa}
                      disabled={loading2FA}
                      className="btn-danger text-xs self-start sm:self-auto"
                    >
                      {loading2FA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      <span>{t('security.disable2fa')}</span>
                    </button>
                  )}
                </div>

                {!twoFactorEnabled ? (
                  /* OPCIONES DE ACTIVACIÓN DE 2FA */
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Opción A: App Autenticadora */}
                      <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                            <QrCode className="w-4 h-4 text-sky-400" />
                            <span>{t('security.authenticatorApp')}</span>
                          </div>
                          <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">{t('security.authenticatorApps')}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleStartTotpSetup}
                          disabled={loading2FA}
                          className="btn-primary w-full text-xs py-2"
                        >
                          {loading2FA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                          <span>{t('security.setUpWithQr')}</span>
                        </button>
                      </div>

                      {/* Opción B: Código por Correo */}
                      <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                            <Mail className="w-4 h-4 text-purple-400" />
                            <span>{t('security.emailOtp')}</span>
                          </div>
                          <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">{t('security.emailOtpDesc')}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRequestEmailOtp}
                          disabled={loading2FA}
                          className="btn-secondary w-full text-xs py-2"
                        >
                          {loading2FA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>{t('security.enableByEmail')}</span>
                        </button>
                      </div>
                    </div>

                    {/* MODAL / SUB-SECCIÓN: CONFIGURACIÓN TOTP CON QR */}
                    {totpSetupData && (
                      <div className="p-5 rounded-[6px] border border-sky-500/30 bg-sky-500/5 space-y-4 animate-in fade-in">
                        <div className="flex items-center justify-between border-b border-sky-500/20 pb-3">
                          <div className="flex items-center gap-2 text-xs font-bold text-sky-400 font-heading">
                            <QrCode className="w-4 h-4" />
                            <span>{t('security.step1ScanQr')}</span>
                          </div>
                          <button
                            onClick={() => setTotpSetupData(null)}
                            className="text-xs text-[var(--text-muted)] hover:text-white"
                          >{t('common.cancel')}</button>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-6">
                          <div className="w-36 h-36 bg-white p-2 rounded-[6px] shrink-0 shadow-lg">
                            <img
                              src={totpSetupData.qrCodeDataUrl}
                              alt="QR 2FA TOTP"
                              className="w-full h-full object-contain"
                            />
                          </div>

                          <div className="space-y-3 w-full text-xs">
                            <p className="text-[var(--text-secondary)] leading-relaxed">{t('security.scanQrDesc')}</p>

                            <div className="flex items-center gap-2 p-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-[11px]">
                              <span className="truncate text-sky-300 font-bold">{totpSetupData.secret}</span>
                              <button
                                type="button"
                                onClick={copySecret}
                                className="ml-auto text-[var(--text-muted)] hover:text-white p-1"
                                title={t('security.copySecretKey')}
                              >
                                {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <form onSubmit={handleEnableTotp} className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                          <div className="w-full sm:flex-1">
                            <input
                              type="text"
                              maxLength={6}
                              autoFocus
                              value={totpCode}
                              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                              placeholder={t('security.enterSixDigitCode')}
                              className="glass-input text-center font-mono tracking-widest text-sm font-bold"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={loading2FA || totpCode.length !== 6}
                            className="btn-primary w-full sm:w-auto px-6 py-2.5"
                          >
                            {loading2FA ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            <span>{t('security.confirmAndEnable')}</span>
                          </button>
                        </form>
                      </div>
                    )}

                    {/* SUB-SECCIÓN: CONFIRMACIÓN EMAIL OTP */}
                    {emailOtpRequested && (
                      <form onSubmit={handleEnableEmailOtp} className="p-5 rounded-[6px] border border-purple-500/30 bg-purple-500/5 space-y-4 animate-in fade-in">
                        <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                          <div className="flex items-center gap-2 text-xs font-bold text-purple-400 font-heading">
                            <Mail className="w-4 h-4" />
                            <span>{t('security.step2EnterEmailCode')}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEmailOtpRequested(false)}
                            className="text-xs text-[var(--text-muted)] hover:text-white"
                          >{t('common.cancel')}</button>
                        </div>

                        <p className="text-xs text-[var(--text-secondary)]">
                          Hemos enviado un código temporal a tu dirección de correo electrónico ({userProfile?.email}).
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <input
                            type="text"
                            maxLength={6}
                            autoFocus
                            value={emailOtpCode}
                            onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ''))}
                            placeholder={t('security.sixDigitCode')}
                            className="glass-input text-center font-mono tracking-widest text-sm font-bold flex-1"
                          />
                          <button
                            type="submit"
                            disabled={loading2FA || emailOtpCode.length !== 6}
                            className="btn-primary w-full sm:w-auto px-6 py-2.5"
                          >
                            {loading2FA ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            <span>{t('security.verifyCode')}</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : (
                  /* 2FA ACTIVADO: DETALLES */
                  <div className="p-4 rounded-[6px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="text-xs space-y-0.5">
                        <div className="font-bold text-[var(--text-primary)]">
                          {twoFactorType === 'EMAIL_OTP' ? t('security.twoFactorEmailActive') : t('security.twoFactorAppActive')}
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)]">{t('security.willAskEachLogin')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 3: CÓDIGOS DE RECUPERACIÓN DE EMERGENCIA */}
              <div className="glass-card p-6 sm:p-7 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('security.emergencyCodes')}</h2>
                        {backupStatus?.hasBackupCodes ? (
                          <span className="badge-status-success font-mono text-[10.5px]">
                            {backupStatus.remainingCount} {backupStatus.remainingCount === 1 ? 'CÓDIGO' : 'CÓDIGOS'}
                          </span>
                        ) : (
                          <span className="badge-status-neutral font-mono text-[10.5px]">{t('security.notGenerated')}</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">{t('security.emergencyCodesDesc')}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartGenerateBackup}
                    disabled={generatingBackup || loadingBackupStatus}
                    className="btn-primary text-xs self-start sm:self-auto shrink-0"
                  >
                    {generatingBackup ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Key className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {backupStatus?.hasBackupCodes ? t('security.regenerateCodes') : t('security.generateEmergencyCodes')}
                    </span>
                  </button>
                </div>

                <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {backupStatus?.hasBackupCodes ? (
                        <p>{t('security.youHave')}{' '}<strong>{backupStatus.remainingCount} códigos de recuperación válidos</strong>{' '}{t('security.codesOnceOnly')}</p>
                      ) : (
                        <p>{t('security.noCodesYet')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: CUENTAS SOCIALES (5 COLS) */}
            <div className="xl:col-span-5 space-y-6">
              {/* CARD: CUENTAS SOCIALES VINCULADAS */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
                    <Link2 className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('security.linkedSocialAccounts')}</h3>
                    <p className="text-[11px] text-[var(--text-secondary)]">{t('security.socialLoginDesc')}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {/* Google */}
                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-[6px] bg-white/5 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[var(--text-primary)]">Google</span>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {userProfile?.googleId ? (userProfile.googleId.includes('@') ? userProfile.googleId : 'Cuenta vinculada') : t('security.notLinked')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 justify-between sm:justify-end w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-[var(--border-subtle)]">
                      <span className={userProfile?.googleId ? 'badge-status-success' : 'badge-status-neutral'}>
                        {userProfile?.googleId ? 'VINCULADO' : t('security.notConnectedUpper')}
                      </span>

                      {userProfile?.googleId ? (
                        <button
                          type="button"
                          onClick={() => handleUnlinkSocial('google')}
                          disabled={unlinkingSocial === 'google'}
                          className="btn-danger text-xs px-2.5 py-1.5 shrink-0"
                        >
                          {unlinkingSocial === 'google' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                          <span>Desvincular</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLinkSocial('google')}
                          className="btn-secondary text-xs px-2.5 py-1.5 shrink-0 hover:border-sky-500/50"
                        >
                          <Link2 className="w-3.5 h-3.5 text-sky-400" />
                          <span>{t('security.linkAccount')}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Discord */}
                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-[6px] bg-white/5 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 fill-[#5865F2]" viewBox="0 0 24 24">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[var(--text-primary)]">Discord</span>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {userProfile?.discordId || t('security.notLinked')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 justify-between sm:justify-end w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-[var(--border-subtle)]">
                      <span className={userProfile?.discordId ? 'badge-status-success' : 'badge-status-neutral'}>
                        {userProfile?.discordId ? 'VINCULADO' : t('security.notConnectedUpper')}
                      </span>

                      {userProfile?.discordId ? (
                        <button
                          type="button"
                          onClick={() => handleUnlinkSocial('discord')}
                          disabled={unlinkingSocial === 'discord'}
                          className="btn-danger text-xs px-2.5 py-1.5 shrink-0"
                        >
                          {unlinkingSocial === 'discord' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                          <span>Desvincular</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLinkSocial('discord')}
                          className="btn-secondary text-xs px-2.5 py-1.5 shrink-0 hover:border-[#5865F2]/50"
                        >
                          <Link2 className="w-3.5 h-3.5 text-[#5865F2]" />
                          <span>{t('security.linkAccount')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN COMPLETA: DISPOSITIVOS & SESIONES ACTIVAS (100% DINÁMICO & CON ICONOS DE MARCA) */}
            <div className="col-span-full glass-card p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--glass-border)] pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('security.activeSessions')}</h2>
                    <p className="text-xs text-[var(--text-secondary)]">{t('security.sessionsDesc')}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRevokeOtherSessions}
                  disabled={revokingOthers || sessions.filter((s) => !s.isCurrent).length === 0}
                  className="btn-danger self-start sm:self-auto shrink-0 disabled:opacity-40"
                  title={t('security.revokeAllOtherSessions')}
                >
                  {revokingOthers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                  <span>{t('security.closeOtherSessions')}</span>
                </button>
              </div>

              {/* Lista Dinámica de Sesiones */}
              {sessions.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-surface)] rounded-[6px] border border-[var(--border-subtle)]">{t('security.noSessionsFound')}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pt-1">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className={`p-4 rounded-[6px] bg-[var(--bg-surface)] border ${
                        sess.isCurrent ? 'border-[var(--border-strong)] shadow-sm' : 'border-[var(--border-subtle)]'
                      } space-y-3 relative overflow-hidden transition-all hover:border-[var(--border-strong)]`}
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Icono directo sin caja contenedora */}
                          <div className="shrink-0 flex items-center justify-center">
                            {renderDeviceBrandIcon(sess.iconType, sess.browser, sess.os)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-[var(--text-primary)] truncate" title={sess.deviceName}>
                              {sess.deviceName || t('security.webDevice')}
                            </div>
                            <div className="text-[10.5px] text-[var(--text-muted)] font-mono truncate">
                              {sess.browser || 'Plex Web'} • {sess.os || 'Desconocido'}
                            </div>
                          </div>
                        </div>

                        {/* Indicador Actual o Botón Revocar Individual */}
                        {sess.isCurrent ? (
                          <span className="badge-status-success shrink-0 text-[10px] px-2 py-0.5 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {t('security.currentSession')}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(sess.id, sess.deviceName || t('security.thisDevice'))}
                            disabled={revokingId === sess.id}
                            className="text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-[4px] transition-colors shrink-0 cursor-pointer"
                            title={t('security.closeThisSession')}
                          >
                            {revokingId === sess.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                            ) : (
                              <span className="text-sm font-bold text-red-400/80 hover:text-red-400 leading-none">✕</span>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Footer con IP y Fecha Relativa */}
                      <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--glass-border)]">
                        <span>IP: {sess.ipAddress}</span>
                        <span className={sess.isCurrent ? 'text-emerald-400 font-semibold' : 'text-[var(--text-secondary)]'}>
                          {formatRelativeTime(t, sess.lastActiveAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ZONA DE PELIGRO: ELIMINACIÓN DE CUENTA (FLUJO EN 2 FASES + GRACIA 24H) */}
            {userProfile?.deletionScheduledAt ? (
              /* ESTADO: CUENTA EN PERIODO DE GRACIA (24 HORAS) */
              <div className="col-span-full glass-card p-6 sm:p-7 border-amber-500/30 bg-amber-500/[0.04] space-y-4 animate-in fade-in duration-200">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-amber-300 font-heading">{t('security.accountScheduledDeletion')}</h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('security.gracePeriodNotice')}</p>
                      <p className="text-xs font-mono font-bold text-amber-400 mt-1">
                        {new Date(userProfile.deletionScheduledAt).toLocaleString('es-ES', {
                          dateStyle: 'full',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelDeletion}
                    disabled={cancellingDeletion}
                    className="px-4 py-2.5 rounded-[6px] text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {cancellingDeletion ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>{t('security.cancelDeletionKeepAccount')}</span>
                  </button>
                </div>

                <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-amber-500/20 text-[11px] text-[var(--text-muted)]">{t('security.cancelDeletionDesc')}</div>
              </div>
            ) : (
              /* ESTADO NORMAL: INICIAR SOLICITUD DE ELIMINACIÓN */
              <div className="col-span-full glass-card p-6 sm:p-7 space-y-4 border-rose-500/20 bg-rose-500/[0.02]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[6px] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading tracking-tight">{t('security.dangerZone')}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('security.dangerZoneDesc')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{t('security.phase1Title')}</span>
                    </span>
                    <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">{t('security.phase1Desc')}</p>
                  </div>

                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>{t('security.phase2Title')}</span>
                    </span>
                    <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">{t('security.phase2Desc')}</p>
                  </div>

                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{t('security.phase3Title')}</span>
                    </span>
                    <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">{t('security.phase3Desc')}</p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-rose-500/15">
                  <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">{t('security.deletionGdprNotice')}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletePasswordInput('');
                      setDelete2FaInput('');
                      setShowDeletionModal(true);
                    }}
                    className="px-3.5 py-2 rounded-[6px] text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-all cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('security.startingDeletionRequest')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL DE SOLICITUD DE ELIMINACIÓN EN 2 FASES */}
      {showDeletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div
            {...propsBorrado}
            className="w-full max-w-md rounded-[8px] border border-rose-500/30 bg-[var(--bg-surface-elevated)] backdrop-blur-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[8px] bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('security.requestAccountDeletion')}</h3>
                  <p className="text-xs text-rose-400 font-mono">{t('security.identityVerificationRequired')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeletionModal(false)}
                className="text-[var(--text-muted)] hover:text-white transition-colors p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('security.enterCredentialsToReceive')}{' '}<strong className="text-[var(--text-primary)]">{userProfile?.email}</strong>{' '}{t('security.finalAuthLink')}</p>

            <form onSubmit={handleRequestDeletion} className="space-y-4">
              {userProfile?.hasPassword && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('security.currentPasswordLabel')}</label>
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500 transition-all">
                    <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    <input
                      type="password"
                      autoFocus
                      required
                      value={deletePasswordInput}
                      onChange={(e) => setDeletePasswordInput(e.target.value)}
                      placeholder={t('security.yourPassword')}
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>
              )}

              {userProfile?.twoFactorEnabled && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                    <span>{t('security.twoFactorCodeLabel')}</span>
                    <span className="text-[10.5px] text-amber-400 font-mono">{t('security.requiredTwoFactorActive')}</span>
                  </label>
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500 transition-all">
                    <Smartphone className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={delete2FaInput}
                      onChange={(e) => setDelete2FaInput(e.target.value.trim())}
                      placeholder={t('security.sixDigitCode')}
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none font-mono tracking-widest"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeletionModal(false)}
                  disabled={requestingDeletion}
                  className="btn-secondary text-xs px-4 py-2 cursor-pointer"
                >{t('common.cancel')}</button>
                <button
                  type="submit"
                  disabled={requestingDeletion}
                  className="px-4 py-2 rounded-[6px] text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {requestingDeletion ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  <span>{t('security.sendConfirmationEmail')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL WIZARD: GENERACIÓN Y VERIFICACIÓN DE CÓDIGOS DE EMERGENCIA */}
      {backupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div
            {...propsRespaldo}
            className="w-full max-w-lg rounded-[8px] border border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] backdrop-blur-2xl shadow-2xl p-6 sm:p-7 space-y-6 animate-in zoom-in-95 duration-150">
            {/* Cabecera del Modal */}
            <div className="flex items-start justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[6px] bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                    {backupStep === 'VIEW' && t('security.wizardStep1')}
                    {backupStep === 'VERIFY' && t('security.wizardStep2')}
                    {backupStep === 'SUCCESS' && t('security.wizardDone')}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {backupStep === 'VIEW' && t('security.shownOnlyOnce')}
                    {backupStep === 'VERIFY' && t('security.checkYouSaved')}
                    {backupStep === 'SUCCESS' && t('security.accountProtected')}
                  </p>
                </div>
              </div>

              {backupStep !== 'VERIFY' && (
                <button
                  onClick={() => setBackupModalOpen(false)}
                  className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* PASO 1: MOSTRAR CÓDIGOS */}
            {backupStep === 'VIEW' && (
              <div className="space-y-5">
                <div className="p-3.5 rounded-[6px] bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <p className="leading-relaxed">
                    <strong>Importante:</strong>{' '}{t('security.saveCodesNow')}<u>{t('security.wontSeeAgain')}</u>.
                  </p>
                </div>

                {/* Grid de Códigos */}
                <div className="grid grid-cols-2 gap-2.5 p-4 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-subtle)] font-mono text-xs">
                  {generatedCodes.map((code, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-[4px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between"
                    >
                      <span className="text-[var(--text-muted)] text-[10.5px]">#{idx + 1}</span>
                      <span className="font-bold text-[var(--text-primary)] tracking-wider select-all">
                        {code}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Botones de Guardado */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyAllCodes}
                    className="btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-2"
                  >
                    {copiedAllCodes ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAllCodes ? 'Copiados' : t('security.copyAll')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCodes}
                    className="btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>Descargar (.txt)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setBackupStep('VERIFY')}
                  className="btn-primary w-full py-2.5 text-xs font-bold"
                >
                  <span>{t('security.savedMyCodes')}</span>
                </button>
              </div>
            )}

            {/* PASO 2: VERIFICACIÓN ALEATORIA */}
            {backupStep === 'VERIFY' && (
              <form onSubmit={handleVerifyAndSaveBackup} className="space-y-5">
                <div className="p-3.5 rounded-[6px] bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />
                  <p className="leading-relaxed">{t('security.toEnableEnter')}{' '}<strong>Código #{challengeNumber}</strong>{' '}{t('security.fromListJustSaved')}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                    <span>Ingresa el Código #{challengeNumber}</span>
                    <span className="font-mono text-[10.5px] text-[var(--text-muted)]">Formato: XXXX-XXXX</span>
                  </label>
                  <input
                    type="text"
                    value={verifyCodeInput}
                    onChange={(e) => setVerifyCodeInput(e.target.value.toUpperCase())}
                    placeholder="Ej. ABCD-1234"
                    autoFocus
                    required
                    maxLength={12}
                    className="glass-input font-mono text-center tracking-widest text-sm uppercase font-bold"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setBackupStep('VIEW')}
                    disabled={verifyingBackup}
                    className="btn-secondary flex-1 py-2.5 text-xs"
                  >
                    <span>{t('security.backToView')}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={verifyingBackup || !verifyCodeInput.trim()}
                    className="btn-primary flex-1 py-2.5 text-xs font-bold"
                  >
                    {verifyingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{t('security.verifyAndEnable')}</span>
                  </button>
                </div>
              </form>
            )}

            {/* PASO 3: ÉXITO */}
            {backupStep === 'SUCCESS' && (
              <div className="space-y-6 text-center py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto animate-in zoom-in-95 duration-200">
                  <CheckCircle2 className="w-7 h-7" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('security.emergencyCodesEnabled')}</h4>
                  <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">{t('security.emergencyCodesEnabledDesc')}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setBackupModalOpen(false)}
                  className="btn-primary w-full py-2.5 text-xs font-bold"
                >
                  <span>{t('security.understoodAndClose')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
