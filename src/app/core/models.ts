export type Role = 'ADMIN' | 'CUSTOMER';
export type UserStatus = 'ACTIVE' | 'LOCKED';
export type AccountType = 'SAVINGS' | 'CHECKING';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type TxnType = 'TRANSFER' | 'DEPOSIT';
export type TxnStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type Direction = 'DEBIT' | 'CREDIT' | 'INTERNAL';

export interface User {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthResponse {
  token: string;
  expiresInSeconds: number;
  user: User;
}

export interface Account {
  id: number;
  accountNumber: string;
  customerId: number;
  customerName: string;
  accountType: AccountType;
  balance: number;
  currency: string;
  status: AccountStatus;
  openedAt: string;
}

export interface Transaction {
  id: number;
  reference: string;
  type: TxnType;
  fromAccount: string | null;
  toAccount: string;
  amount: number;
  currency: string;
  status: TxnStatus;
  description: string | null;
  failureReason: string | null;
  initiatedBy: number;
  createdAt: string;
  completedAt: string | null;
  direction: Direction | null;
}

/** A saved payee. Only the nickname can change; a new account number is a new payee. */
export interface Beneficiary {
  id: number;
  nickname: string;
  accountNumber: string;
  createdAt: string;
}

/** Each service keeps its own audit log; the source picks which one to read. */
export type AuditSource = 'auth' | 'accounts' | 'transactions';
export type AuditOutcome = 'SUCCESS' | 'FAILURE';

/**
 * One state-changing request, successful or not. Reads are never recorded. For a failed
 * LOGIN, actorEmail is the email that was tried and actorId is null.
 */
export interface AuditEntry {
  id: number;
  occurredAt: string;
  service: AuditSource;
  actorId: number | null;
  actorRole: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  outcome: AuditOutcome;
  httpStatus: number | null;
  reason: string | null;
  details: Record<string, string>;
  correlationId: string | null;
  sourceIp: string | null;
}

/** Spring Data page, serialized with PageSerializationMode.VIA_DTO. */
export interface Page<T> {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
}

export interface UserSummary {
  totalCustomers: number;
  activeCustomers: number;
  lockedCustomers: number;
  newCustomersLast30Days: number;
  admins: number;
}

export interface AccountSummary {
  totalAccounts: number;
  activeAccounts: number;
  frozenAccounts: number;
  totalDeposits: number;
  byType: { accountType: AccountType; count: number; balance: number }[];
}

export interface DailyVolume {
  date: string;
  count: number;
  amount: number;
}

export interface TransactionSummary {
  transactionsToday: number;
  volumeToday: number;
  failedLast7Days: number;
  pending: number;
  last14Days: DailyVolume[];
}

export interface SystemHealth {
  overall: 'UP' | 'DEGRADED';
  checkedAt: string;
  services: { service: string; status: string; latencyMs: number }[];
}

/** RFC 9457 problem detail returned by every service on error. */
export interface Problem {
  status: number;
  detail?: string;
  errors?: Record<string, string>;
  reference?: string;
}
