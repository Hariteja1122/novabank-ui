import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BankApi } from '../../core/bank-api';
import { problemMessage } from '../../core/http.interceptors';
import { AccountSummary, Transaction, TransactionSummary, UserSummary } from '../../core/models';
import { AccountMaskPipe } from '../../shared/format';
import { VolumeChart } from './volume-chart';

@Component({
  selector: 'nb-admin-dashboard',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, AccountMaskPipe, VolumeChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Operations overview</h1>
          <p>Live figures from the auth, account and transaction services.</p>
        </div>
        <a class="btn btn-primary" routerLink="/admin/transactions" [queryParams]="{ deposit: 1 }">Record deposit</a>
      </div>

      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

      <div class="grid kpis">
        <div class="panel kpi">
          <div class="label">Deposits held</div>
          <div class="value">{{ (accounts()?.totalDeposits ?? 0) | currency: 'USD' : 'symbol' : '1.0-0' }}</div>
          <div class="foot">{{ accounts()?.activeAccounts ?? 0 }} active of {{ accounts()?.totalAccounts ?? 0 }} accounts</div>
        </div>
        <div class="panel kpi">
          <div class="label">Customers</div>
          <div class="value">{{ users()?.totalCustomers ?? 0 | number }}</div>
          <div class="foot">{{ users()?.newCustomersLast30Days ?? 0 }} joined in the last 30 days</div>
        </div>
        <div class="panel kpi">
          <div class="label">Transactions today</div>
          <div class="value">{{ txns()?.transactionsToday ?? 0 | number }}</div>
          <div class="foot">{{ (txns()?.volumeToday ?? 0) | currency: 'USD' : 'symbol' : '1.0-0' }} moved</div>
        </div>
        <div class="panel kpi" [class.attention]="(txns()?.failedLast7Days ?? 0) > 0 || (accounts()?.frozenAccounts ?? 0) > 0">
          <div class="label">Needs attention</div>
          <div class="value">{{ (txns()?.failedLast7Days ?? 0) + (users()?.lockedCustomers ?? 0) + (accounts()?.frozenAccounts ?? 0) }}</div>
          <div class="foot">{{ txns()?.failedLast7Days ?? 0 }} failed, {{ users()?.lockedCustomers ?? 0 }} locked, {{ accounts()?.frozenAccounts ?? 0 }} frozen</div>
        </div>
      </div>

      <div class="grid grid-main">
        <section class="panel">
          <div class="panel-head"><h2>Daily volume</h2></div>
          <div class="panel-body">
            @if (txns(); as t) { <nb-volume-chart [days]="t.last14Days" /> }
            @else { <div class="skeleton" style="height: 220px"></div> }
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Book by account type</h2></div>
          <div class="panel-body types">
            @for (t of accounts()?.byType ?? []; track t.accountType) {
              <div class="type">
                <div class="row"><span>{{ t.accountType === 'SAVINGS' ? 'Savings' : 'Checking' }}</span><b class="num">{{ t.balance | currency: 'USD' : 'symbol' : '1.0-0' }}</b></div>
                <div class="meter"><span [class.sav]="t.accountType === 'SAVINGS'" [style.width.%]="share(t.balance)"></span></div>
                <div class="small muted">{{ t.count }} accounts</div>
              </div>
            }
          </div>
        </section>
      </div>

      <section class="panel" style="margin-top: 20px">
        <div class="panel-head">
          <h2>Recent failed transactions</h2>
          <a class="btn btn-link" routerLink="/admin/transactions" [queryParams]="{ status: 'FAILED' }">View all</a>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Reference</th><th>From</th><th>To</th><th>Reason</th><th>When</th><th class="right">Amount</th></tr></thead>
            <tbody>
              @for (t of failed(); track t.id) {
                <tr>
                  <td class="num small">{{ t.reference }}</td>
                  <td class="num">{{ t.fromAccount | acctMask }}</td>
                  <td class="num">{{ t.toAccount | acctMask }}</td>
                  <td class="small debit">{{ t.failureReason }}</td>
                  <td class="small muted">{{ t.createdAt | date: 'MMM d, h:mm a' }}</td>
                  <td class="right money">{{ t.amount | currency }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6"><div class="empty"><strong>No failed transactions</strong>Everything in the last week went through.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
  styles: `
    .kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 20px; }
    .kpi.attention { border-left: 3px solid var(--brass); }
    .types { display: grid; gap: 22px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .row b { font-weight: 500; }
    .meter { height: 8px; border-radius: 4px; background: var(--paper); overflow: hidden; margin-bottom: 6px; }
    .meter span { display: block; height: 100%; background: var(--ledger); border-radius: 4px; }
    .meter span.sav { background: var(--brass); }
    @media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) { .kpis { grid-template-columns: 1fr; } }
  `,
})
export class AdminDashboard {
  private readonly api = inject(BankApi);
  protected readonly users = signal<UserSummary | null>(null);
  protected readonly accounts = signal<AccountSummary | null>(null);
  protected readonly txns = signal<TransactionSummary | null>(null);
  protected readonly failed = signal<Transaction[]>([]);
  protected readonly error = signal<string | null>(null);

  constructor() {
    forkJoin({
      users: this.api.userSummary(),
      accounts: this.api.accountSummary(),
      txns: this.api.transactionSummary(),
      failed: this.api.adminTransactions({ status: 'FAILED', size: 5 }),
    }).subscribe({
      next: (r) => {
        this.users.set(r.users);
        this.accounts.set(r.accounts);
        this.txns.set(r.txns);
        this.failed.set(r.failed.content);
      },
      error: (e) => this.error.set(problemMessage(e)),
    });
  }

  protected share(balance: number): number {
    const total = this.accounts()?.totalDeposits || 1;
    return Math.min(100, (balance / total) * 100);
  }
}
