import {
  AlertCircle,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: 'tickets.catTechnical',
  SCROBBLE_SYNC: 'tickets.catScrobble',
  MAPPINGS: 'tickets.catMapping',
  ACCOUNT: 'tickets.catAccount',
  FEATURE_REQUEST: 'tickets.catFeature',
  OTHER: 'tickets.catOther',
};

const PRIORITY_STYLES: Record<string, { label: string; class: string }> = {
  LOW: { label: 'tickets.prioLow', class: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' },
  NORMAL: { label: 'tickets.prioNormal', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25' },
  HIGH: { label: 'tickets.prioHigh', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25' },
  URGENT: { label: 'tickets.prioUrgent', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25' },
};

const STATUS_STYLES: Record<string, { label: string; class: string; icon: any }> = {
  OPEN: { label: 'tickets.statusOpen', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', icon: AlertCircle },
  WAITING_USER: { label: 'admin.waitingUser', class: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25', icon: MessageSquare },
  IN_PROGRESS: { label: 'tickets.underReview', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25', icon: Clock },
  RESOLVED: { label: 'tickets.statusResolved', class: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25', icon: CheckCircle2 },
  CLOSED: { label: 'tickets.statusClosed', class: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20', icon: XCircle },
};

export { CATEGORY_LABELS, PRIORITY_STYLES, STATUS_STYLES };
