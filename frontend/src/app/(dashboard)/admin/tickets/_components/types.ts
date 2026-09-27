interface AdminTicketItem {
  id: string;
  ticketNumber: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  lastReplyAt: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    avatarUrl?: string | null;
    role: string;
  };
  assignedAdmin?: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  } | null;
  _count?: {
    messages: number;
  };
}

interface TicketStats {
  total: number;
  open: number;
  waitingUser: number;
  inProgress: number;
  resolved: number;
  closed: number;
  pendingStaff: number;
  urgent: number;
  todayResolved: number;
}

export type { AdminTicketItem, TicketStats };
