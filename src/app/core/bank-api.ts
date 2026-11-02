import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  Account, AccountStatus, AccountSummary, AccountType, Page, SystemHealth, Transaction,
  TransactionSummary, TxnStatus, TxnType, User, UserStatus, UserSummary,
} from './models';

type Query = Record<string, string | number | null | undefined>;

function params(q: Query): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  }
  return p;
}

/** Every NovaBank REST call in one place, all through the API gateway. */
@Injectable({ providedIn: 'root' })
export class BankApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  // ---- profile
  me() { return this.http.get<User>(`${this.base}/auth/me`); }
  updateProfile(body: { fullName: string; phone: string | null }) { return this.http.put<User>(`${this.base}/auth/me`, body); }
  changePassword(body: { currentPassword: string; newPassword: string }) {
    return this.http.post<void>(`${this.base}/auth/change-password`, body);
  }

  // ---- customer accounts
  myAccounts() { return this.http.get<Account[]>(`${this.base}/accounts`); }
  account(no: string) { return this.http.get<Account>(`${this.base}/accounts/${no}`); }
  openOwnAccount(accountType: AccountType) { return this.http.post<Account>(`${this.base}/accounts`, { accountType }); }

  // ---- customer transactions
  history(q: { account?: string | null; page?: number; size?: number }) {
    return this.http.get<Page<Transaction>>(`${this.base}/transactions`, { params: params(q) });
  }
  transfer(body: { fromAccount: string; toAccount: string; amount: number; description: string | null }, idempotencyKey: string) {
    return this.http.post<Transaction>(`${this.base}/transactions/transfer`, body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  // ---- admin
  users(q: { role?: string; status?: UserStatus | ''; q?: string; page?: number; size?: number }) {
    return this.http.get<Page<User>>(`${this.base}/admin/users`, { params: params(q) });
  }
  userSummary() { return this.http.get<UserSummary>(`${this.base}/admin/users/summary`); }
  setUserStatus(id: number, status: UserStatus) {
    return this.http.patch<User>(`${this.base}/admin/users/${id}/status`, { status });
  }
  adminAccounts(q: { status?: AccountStatus | ''; type?: AccountType | ''; customerId?: number | null; q?: string; page?: number; size?: number }) {
    return this.http.get<Page<Account>>(`${this.base}/admin/accounts`, { params: params(q) });
  }
  accountSummary() { return this.http.get<AccountSummary>(`${this.base}/admin/accounts/summary`); }
  adminOpenAccount(body: { customerId: number; customerName: string; accountType: AccountType; initialDeposit: number }) {
    return this.http.post<Account>(`${this.base}/admin/accounts`, body);
  }
  setAccountStatus(no: string, status: AccountStatus) {
    return this.http.patch<Account>(`${this.base}/admin/accounts/${no}/status`, { status });
  }
  adminTransactions(q: { status?: TxnStatus | ''; type?: TxnType | ''; q?: string; page?: number; size?: number }) {
    return this.http.get<Page<Transaction>>(`${this.base}/admin/transactions`, { params: params(q) });
  }
  transactionSummary() { return this.http.get<TransactionSummary>(`${this.base}/admin/transactions/summary`); }
  deposit(body: { toAccount: string; amount: number; description: string | null }, idempotencyKey: string) {
    return this.http.post<Transaction>(`${this.base}/admin/transactions/deposit`, body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }
  systemHealth() { return this.http.get<SystemHealth>(`${this.base}/system/health`); }
}
